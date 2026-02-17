import express from "express";
import { getCompanyPool } from "./multiCompanyDb.js";
import { randomUUID } from "crypto";

const router = express.Router();

// Get list of active surveys
router.get("/list", async (req, res) => {
    try {
        const { companyCode, employeeNo } = req.query;

        if (!companyCode || !employeeNo) {
            return res.status(400).json({
                success: false,
                message: "Company code and employee number are required"
            });
        }

        const pool = await getCompanyPool(companyCode);
        console.log(`[Survey List] Connected to DB Pool for ${companyCode}`);

        // 1. Get Partner ID
        let partnerId = null;
        if (employeeNo) {
            const empRes = await pool.query(
                `SELECT u.partner_id FROM hr_employee e
                  LEFT JOIN res_users u ON e.user_id = u.id
                  WHERE LOWER(TRIM(e."x_Emp_No")) = LOWER(TRIM($1))`,
                [employeeNo]
            );
            if (empRes.rows.length > 0) partnerId = empRes.rows[0].partner_id;
        }

        // 2. Get Active Surveys
        let queryText = `SELECT id, title, description, questions_layout, access_mode, active, create_date, survey_start_date, survey_end_date, state, survey_type
       FROM survey_survey
       WHERE active = true AND state != 'draft'`;

        const queryParams = [];
        if (req.query.type) {
            queryParams.push(req.query.type);
            queryText += ` AND survey_type = $${queryParams.length}`;
        } else {
            // Default behavior: Exclude 'feedback' type if not explicitly requested, to keep "Surveys" tab clean
            // Or maybe just show everything not 'feedback' if that's what "Surveys" tab implies
            queryText += ` AND survey_type != 'feedback'`;
        }

        queryText += ` ORDER BY create_date DESC`;

        const surveyResult = await pool.query(queryText, queryParams);

        let surveys = surveyResult.rows.map(s => ({
            ...s,
            title: typeof s.title === 'object' && s.title ? (s.title['en_US'] || Object.values(s.title)[0] || '') : s.title,
            description: typeof s.description === 'object' && s.description ? (s.description['en_US'] || Object.values(s.description)[0] || '') : s.description,
            start_date: s.survey_start_date,
            end_date: s.survey_end_date,
            create_date: s.create_date
        }));

        // 3. Mark Submitted
        let submittedMap = new Map();
        if (partnerId) {
            console.log(`[Survey List] Checking submissions for Partner ID: ${partnerId}`);
            const subRes = await pool.query(
                `SELECT survey_id, state, create_date FROM survey_user_input WHERE partner_id = $1`,
                [partnerId]
            );
            subRes.rows.filter(r => r.state === 'done').forEach(r => {
                submittedMap.set(r.survey_id, r.create_date);
            });
        } else {
            // Fallback: Check by nickname (Employee No)
            console.log(`[Survey List] Checking submissions for Nickname: ${employeeNo}`);
            const subRes = await pool.query(
                `SELECT survey_id, state, create_date FROM survey_user_input WHERE nickname = $1`,
                [employeeNo]
            );
            subRes.rows.filter(r => r.state === 'done').forEach(r => {
                submittedMap.set(r.survey_id, r.create_date);
            });
        }
        surveys = surveys.map(s => ({
            ...s,
            has_submitted: submittedMap.has(s.id),
            submitted_at: submittedMap.get(s.id) || null
        }));

        res.json({
            success: true,
            surveys: surveys
        });

    } catch (error) {
        console.error("❌ Fetch surveys error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch surveys",
            error: error.message
        });
    }
});

// Get survey details and questions
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { companyCode, employeeNo } = req.query;

        if (!companyCode) {
            return res.status(400).json({
                success: false,
                message: "Company code is required"
            });
        }

        const pool = await getCompanyPool(companyCode);

        // Get Survey Info
        const surveyResult = await pool.query(
            `SELECT id, title, description, questions_layout, access_mode, use_custom_layout
       FROM survey_survey 
       WHERE id = $1`,
            [id]
        );

        if (surveyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Survey not found"
            });
        }

        const survey = surveyResult.rows[0];
        const processedSurvey = {
            ...survey,
            title: typeof survey.title === 'object' && survey.title ? (survey.title['en_US'] || Object.values(survey.title)[0] || '') : survey.title,
            description: typeof survey.description === 'object' && survey.description ? (survey.description['en_US'] || Object.values(survey.description)[0] || '') : survey.description
        };

        // Fetch questions and sections
        const questionsRes = await pool.query(
            `SELECT id, title, description, question_type, constr_mandatory, sequence, validation_required, is_page
           FROM survey_question 
           WHERE survey_id = $1 
           ORDER BY sequence, id`,
            [id]
        );

        const rawQuestions = questionsRes.rows.map(q => ({
            ...q,
            title: typeof q.title === 'object' && q.title ? (q.title['en_US'] || Object.values(q.title)[0] || '') : q.title,
            description: typeof q.description === 'object' && q.description ? (q.description['en_US'] || Object.values(q.description)[0] || '') : q.description
        }));

        const layoutSections = [];
        const questions = [];

        // Logic branching: Custom Layout (survey_layout_section) VS Standard Odoo Pages (is_page)
        console.log(`[Survey Detail] ID: ${id}, Use Custom Layout: ${processedSurvey.use_custom_layout}`);

        if (processedSurvey.use_custom_layout) {
            // 1. Fetch Layout Sections
            const sectionsRes = await pool.query(
                `SELECT id, name, sequence, icon, description, active
                 FROM survey_layout_section
                 WHERE survey_id = $1 AND active = true
                 ORDER BY sequence, id`,
                [id]
            );
            console.log(`[Survey Detail] Found ${sectionsRes.rowCount} active sections.`);

            // 2. Fetch Mappings (Relation table)
            const sectionIds = sectionsRes.rows.map(s => s.id);
            let relRes = { rows: [] };
            if (sectionIds.length > 0) {
                relRes = await pool.query(
                    `SELECT section_id, question_id FROM survey_layout_section_question_rel 
                     WHERE section_id = ANY($1)`,
                    [sectionIds]
                );
            }
            console.log(`[Survey Detail] Found ${relRes.rows.length} question-section mappings.`);

            // Map QuestionId -> SectionId
            const qToSectionMap = {};
            relRes.rows.forEach(r => {
                qToSectionMap[r.question_id] = r.section_id;
            });

            // 3. Build Sections
            const sectionsMap = {};
            sectionsRes.rows.forEach(s => {
                sectionsMap[s.id] = {
                    id: s.id,
                    name: s.name,
                    sequence: s.sequence,
                    icon: s.icon || 'fa-list',
                    description: s.description || '',
                    questions: []
                };
            });

            // 4. Distribute questions
            // We also need to collect unassigned questions to put them somewhere (e.g., a default section)
            // or else they will disappear. Users usually expect all questions to show up.
            const unassignedQuestions = [];

            rawQuestions.forEach(q => {
                questions.push(q); // Keep flat list refernece
                if (q.is_page) return; // Skip pages in this mode as we use custom sections

                const sectionId = qToSectionMap[q.id];
                if (sectionId && sectionsMap[sectionId]) {
                    sectionsMap[sectionId].questions.push(q);
                } else {
                    unassignedQuestions.push(q);
                }
            });

            // Convert map to array
            Object.values(sectionsMap)
                .sort((a, b) => a.sequence - b.sequence)
                .forEach(s => {
                    if (s.questions.length > 0) layoutSections.push(s);
                });

            // If there are unassigned questions, add them to a "General" or "Other" section at the end
            if (unassignedQuestions.length > 0) {
                console.log(`[Survey Detail] Found ${unassignedQuestions.length} unassigned questions. Adding to 'General' section.`);
                layoutSections.push({
                    id: 'unassigned',
                    name: 'General',
                    sequence: 9999,
                    icon: 'fa-question-circle',
                    description: '',
                    questions: unassignedQuestions
                });
            }

        } else {
            // STANDARD BEHAVIOR (is_page = true logic)
            let currentSection = {
                id: 'default',
                name: processedSurvey.title, // Default to survey title
                questions: []
            };

            let isFirst = true;
            for (const q of rawQuestions) {
                if (q.is_page) {
                    if (currentSection.questions.length > 0 || (layoutSections.length === 0 && !isFirst)) {
                        layoutSections.push(currentSection);
                    }
                    // Start new section
                    currentSection = {
                        id: q.id,
                        name: q.title,
                        questions: []
                    };
                } else {
                    currentSection.questions.push(q);
                    questions.push(q); // Add to flat list
                }
                isFirst = false;
            }
            if (currentSection.questions.length > 0 || layoutSections.length === 0 || currentSection.id !== 'default') {
                layoutSections.push(currentSection);
            }
        }


        // Fetch choices (simple_choice, multiple_choice)
        for (const q of questions) {
            if (['simple_choice', 'multiple_choice', 'dropdown'].includes(q.question_type)) {
                const choicesRes = await pool.query(
                    `SELECT id, value, sequence 
                     FROM survey_question_answer 
                     WHERE question_id = $1 
                     ORDER BY sequence, id`,
                    [q.id]
                );
                q.choices = choicesRes.rows.map(c => ({
                    ...c,
                    value: typeof c.value === 'object' && c.value ? (c.value['en_US'] || Object.values(c.value)[0] || '') : c.value
                }));
            }
        }

        // Check Submission Status
        let hasSubmitted = false;
        let previousAnswers = {};
        let submissionDate = null;

        if (employeeNo) {
            const empResult = await pool.query(
                `SELECT e.id, e.name, u.partner_id 
                 FROM hr_employee e
                 LEFT JOIN res_users u ON e.user_id = u.id
                 WHERE LOWER(TRIM(e."x_Emp_No")) = LOWER(TRIM($1))`,
                [employeeNo]
            );

            if (empResult.rows.length > 0) {
                const partnerId = empResult.rows[0].partner_id;

                let submissionRes;
                if (partnerId) {
                    submissionRes = await pool.query(
                        `SELECT id, create_date FROM survey_user_input 
                         WHERE survey_id = $1 AND partner_id = $2 AND state = 'done' 
                         ORDER BY create_date DESC LIMIT 1`,
                        [id, partnerId]
                    );
                } else {
                    submissionRes = await pool.query(
                        `SELECT id, create_date FROM survey_user_input 
                         WHERE survey_id = $1 AND nickname = $2 AND state = 'done' 
                         ORDER BY create_date DESC LIMIT 1`,
                        [id, employeeNo]
                    );
                }

                if (submissionRes.rows.length > 0) {
                    hasSubmitted = true;
                    const userInputId = submissionRes.rows[0].id;
                    submissionDate = submissionRes.rows[0].create_date;

                    const linesRes = await pool.query(
                        `SELECT question_id, value_char_box, value_text_box, value_numerical_box, suggested_answer_id
                         FROM survey_user_input_line 
                         WHERE user_input_id = $1`,
                        [userInputId]
                    );

                    linesRes.rows.forEach(line => {
                        let val = line.suggested_answer_id || line.value_char_box || line.value_text_box || line.value_numerical_box;
                        const qId = line.question_id;
                        if (previousAnswers[qId]) {
                            if (Array.isArray(previousAnswers[qId])) {
                                previousAnswers[qId].push(val);
                            } else {
                                previousAnswers[qId] = [previousAnswers[qId], val];
                            }
                        } else {
                            previousAnswers[qId] = val; // Single value initially
                        }
                    });
                }
            }
        }

        res.json({
            success: true,
            survey: processedSurvey,
            questions: questions,
            layoutSections: layoutSections,
            hasSubmitted,
            previousAnswers,
            submissionDate
        });

    } catch (error) {
        console.error("❌ Fetch survey details error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch survey details",
            error: error.message
        });
    }
});

// Submit survey
router.post("/:id/submit", async (req, res) => {
    try {
        const { id } = req.params;
        const { companyCode, employeeNo, answers } = req.body;
        // answers: Array of { questionId, value (text/number), answerId (for choices) }

        if (!companyCode || !employeeNo || !answers) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const pool = await getCompanyPool(companyCode);

        // Fetch employee
        const empResult = await pool.query(
            `SELECT e.id, e.name, u.partner_id 
             FROM hr_employee e
             LEFT JOIN res_users u ON e.user_id = u.id
             WHERE LOWER(TRIM(e."x_Emp_No")) = LOWER(TRIM($1))`,
            [employeeNo]
        );

        if (empResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const employee = empResult.rows[0];
        const partnerId = employee.partner_id || null;
        const nickname = partnerId ? null : employeeNo;

        // 1. Create survey_user_input
        // State: 'new', 'in_progress', 'done'
        const accessToken = randomUUID();
        const userInputResult = await pool.query(
            `INSERT INTO survey_user_input (survey_id, partner_id, state, create_date, write_date, start_datetime, end_datetime, access_token, nickname, employee_name, employee_no, create_uid, write_uid)
         VALUES ($1, $2, 'done', NOW(), NOW(), NOW(), NOW(), $3, $4, $5, $6, 2, 2)
         RETURNING id`,
            [id, partnerId, accessToken, nickname, employee.name, employeeNo]
        );
        const userInputId = userInputResult.rows[0].id;

        // 2. Insert Answers
        // First, get question sequences
        const questionIds = answers.map(a => a.questionId);
        const questionSeqResult = await pool.query(
            `SELECT id, sequence FROM survey_question WHERE id = ANY($1)`,
            [questionIds]
        );
        const questionSeqMap = {};
        questionSeqResult.rows.forEach(q => {
            questionSeqMap[q.id] = q.sequence || 0;
        });

        for (const ans of answers) {
            let valueChar = null;
            let valueText = null;
            let valueNumber = null;
            let suggestedAnswerId = null;
            let answerType = 'char_box'; // default

            if (ans.answerId) {
                suggestedAnswerId = ans.answerId;
                answerType = 'suggestion';
            } else if (typeof ans.value === 'number') {
                valueNumber = ans.value;
                answerType = 'numerical_box';
            } else if (typeof ans.value === 'string') {
                if (ans.value.length > 255) {
                    valueText = ans.value;
                    answerType = 'text_box';
                } else {
                    valueChar = ans.value;
                    answerType = 'char_box';
                }
            }

            const questionSequence = questionSeqMap[ans.questionId] || 0;

            await pool.query(
                `INSERT INTO survey_user_input_line 
             (user_input_id, survey_id, question_id, question_sequence, answer_type, value_char_box, value_text_box, value_numerical_box, suggested_answer_id, skipped, create_date, write_date, create_uid, write_uid)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW(), 2, 2)`,
                [userInputId, id, ans.questionId, questionSequence, answerType, valueChar, valueText, valueNumber, suggestedAnswerId]
            );
        }

        res.json({
            success: true,
            message: "Survey submitted successfully",
            submissionId: userInputId
        });

    } catch (error) {
        console.error("❌ Survey submission error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit survey",
            error: error.message
        });
    }
});

export default router;
