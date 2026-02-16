import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";


const router = express.Router();

// Define routes
router.get("/", (req, res) => {
  const userToken = getTokenFromHeader(req);
  const decoded = jwt.verify(userToken, SECRET_KEY);
  // console.log("project decoded employeeId " + decoded.employeeId);
  // console.log("project decoded customerId " + decoded.customerId);
  const queryString = `select * from usp_projects_by_site($1,$2) `;
  query(queryString, [null, null], (error, dbResponse) => {
    if (error) {
      console.error("Error fetching projects:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    const projects = dbResponse.rows.map((item) => ({
      projectId: item.out_project_id,
      projectName: item.out_project_name,
      isOpen: item.out_is_open,
    }));
    res.json(projects);
  });
});

router.get("/:siteId", (req, res) => {
  const siteId = req.params.siteId;
  const userToken = getTokenFromHeader(req);
  const decoded = jwt.verify(userToken, SECRET_KEY);
  const queryString = `select * from usp_projects_by_site($1,$2) `;
  query(queryString, [siteId, decoded.employeeId], (error, dbResponse) => {
    if (error) {
      console.error("Error fetching projects:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    const projects = dbResponse.rows.map((item) => ({
      projectId: item.out_project_id,
      projectName: item.out_project_name,
      isOpen: item.out_is_open,
    }));
    res.json(projects);
  });
});
export default router; 
