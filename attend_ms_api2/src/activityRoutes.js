import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";

const router = express.Router();

// Define routes
router.get("/", (req, res) => {
  const userToken = getTokenFromHeader(req);
  const decoded = jwt.verify(userToken, SECRET_KEY);

  const queryString = `select 
                      TO_CHAR(clock_in_date::date + clock_in::time, 'YYYY-MM-DD HH24:MI') as start_time,
                      TO_CHAR(clock_out_date::date + clock_out::time, 'YYYY-MM-DD HH24:MI') as end_time,
                       EXTRACT(EPOCH FROM ((clock_out_date::date + clock_out::time) - (clock_in_date::date + clock_in::time))) / 60 as working_hours,
                      e.id as nid,
                      e.in_lat as start_loc_lat,
                      e.in_lan as start_loc_long,
                      clock_in_location as start_loc_name,
                      e.out_lat as end_loc_lat,
                      e.out_lan as end_loc_long,
                      clock_out_location as end_loc_name,
                      e.project_id,
                  	  site_location
                    from employee_clocking_line e
                    left join project_project pp
                    on e.project_id=pp.id
                    where employee_id =$1 and clock_in_date is not null
                    order by clock_in_date::date + clock_in::time desc`;
  console.log("activity decoded.employeeId: " + decoded.employeeId);
  query(queryString, [decoded.employeeId], (error, dbResponse) => {
    const activities = dbResponse.rows.map((item) => ({
      startTime: item.start_time,
      endTime: item.end_time,
      workingHours: item.working_hours,
      nid: item.nid,
      startLocLat: item.start_loc_lat,
      startLocLng: item.start_loc_long,
      startLocName: item.start_loc_name,
      endLocLat: item.end_loc_lat,
      endLocLong: item.end_loc_long,
      endLocName: item.end_loc_name,
      projectId: item.project_id,
      customerId: item.customer_id,
      siteLocation: item.site_location,
    }));
    res.json(activities);
  });
});

router.post("/", (req, res) => {
  const userToken = getTokenFromHeader(req);
  console.log(userToken);
  const reqBody = req.body;
  const isCheckin = reqBody.isCheckIn;
  const isOT = reqBody.isOT;
  const decoded = jwt.verify(userToken, SECRET_KEY);
  // let v_interrid = null;
  // let v_strmessage = null;
  // let v_employeeno = null;
  // let v_clockin_id = 0;
  console.log("enroll JSON.stringify(reqBody): " + JSON.stringify(reqBody));
  const now = new Date();
  const queryString = `select * from public.udf_insert_employee_clocking(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  )`;

  query(
    queryString,
    [
      decoded.nid,
      2, // create_uid - use admin user ID (2) instead of employeeId
      2, // write_uid - use admin user ID (2) instead of employeeId
      decoded.employeeNo,
      now.getTime(),
      now,
      reqBody.location,
      isCheckin ? 1 : 2,
      reqBody.lat,
      reqBody.long,
      reqBody.location,
      reqBody.projectId,
      reqBody.siteId,
    ],
    (error, dbResponse) => {
      if (!error) {
        const message = dbResponse.rows[0].message;
        console.log("Clocking response: " + message);
        res.json({
          message: message,
        });
      }
      if (error) {
        // Handle database errors
        console.error("Database Error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );
});

// router.post("/", (req, res) => {
//   const userToken = getTokenFromHeader(req);
//   console.log(userToken);
//   const reqBody = req.body;
//   const isCheckin = reqBody.isCheckIn;
//   const isOT = reqBody.isOT;
//   const decoded = jwt.verify(userToken, SECRET_KEY);
//   if (isOT) {
//     const OTquery = `INSERT INTO public.attendance_activities
//             (employee_id,customer_id, start_time, end_time, is_ot, created_date, project_id)
//             VALUES($1, $2, $3, $3::timestamp + ($4 * INTERVAL '1 hour', $5), true, now());`;
//     db.query(
//       OTquery,
//       [
//         decoded.employeeId,
//         decoded.customerId,
//         reqBody.OTDate,
//         reqBody.OTHours,
//         reqBody.projectId,
//       ],
//       (error, dbResponse) => {
//         console.log(error);
//         if (!error)
//           res.json({ success: true, message: "OT Clocked successcully" });
//         else res.json({ success: false, message: "Failed to clock OT" });
//       }
//     );
//   } else {
//     var query;
//     if (isCheckin) {
//       query = `INSERT INTO public.attendance_activities
//               (employee_id,customer_id, start_time, end_time, is_ot, created_date, start_loc_lat, start_loc_long, start_loc_name, project_id)
//               VALUES($1, $2, now(), null, false, now(), $3, $4, $5, $6);`;
//     } else {
//       query = `UPDATE public.attendance_activities
//               SET end_time = NOW(),
//                   end_loc_lat=$3,
//                   end_loc_long=$4,
//                   end_loc_name=$5
//               WHERE nid = (
//                 SELECT nid
//                 FROM public.attendance_activities
//                 WHERE end_time IS NULL
//                   and project_id=$6
//                 ORDER BY start_time DESC
//                 LIMIT 1
//               ) and employee_id=$1 and customer_id=$2`;
//     }
//     queryParam = [
//       decoded.employeeId,
//       decoded.customerId,
//       reqBody.lat,
//       reqBody.long,
//       reqBody.location,
//       reqBody.projectId,
//     ];
//     db.query(query, queryParam, (error, dbResponse) => {
//       console.log(error);
//       if (!error)
//         res.json({
//           success: true,
//           message: "Check " + (isCheckin ? "in" : "out") + " successcully",
//         });
//       else
//         res.json({
//           success: false,
//           message: "Failed to check " + (isCheckin ? "in" : "out"),
//         });
//     });
//   }
// });

router.put("/users/:id", (req, res) => {
  const userId = req.params.id;
  res.send(`Update user ${userId}`);
});

router.delete("/users/:id", (req, res) => {
  const userId = req.params.id;
  res.send(`Delete user ${userId}`);
});

export default router;
