import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import getUserRoute from "./routes/auth/get-user/route";
import loginRoute from "./routes/auth/login/route";
import logoutRoute from "./routes/auth/logout/route";
import refreshTokenRoute from "./routes/auth/refresh-token/route";
import clockRoute from "./routes/attendance/clock/route";
import getAttendanceRoute from "./routes/attendance/get-attendance/route";
import applyLeaveRoute from "./routes/leaves/apply/route";
import getLeavesRoute from "./routes/leaves/get-leaves/route";
import updateLeaveStatusRoute from "./routes/leaves/update-status/route";
import getToolboxMeetingsRoute from "./routes/toolbox/get-meetings/route";
import acknowledgeMeetingRoute from "./routes/toolbox/acknowledge-meeting/route";
import getPayslipsRoute from "./routes/payslips/get-payslips/route";
import markPayslipViewedRoute from "./routes/payslips/mark-viewed/route";
import createToolboxMeetingRoute from "./routes/toolbox/create-meeting/route";
import updateToolboxMeetingRoute from "./routes/toolbox/update-meeting/route";
import deleteToolboxMeetingRoute from "./routes/toolbox/delete-meeting/route";
import upsertToolboxAttendeeRoute from "./routes/toolbox/upsert-attendee/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    getUser: getUserRoute,
    login: loginRoute,
    logout: logoutRoute,
    refreshToken: refreshTokenRoute,
  }),
  attendance: createTRPCRouter({
    clock: clockRoute,
    getAttendance: getAttendanceRoute,
  }),
  leaves: createTRPCRouter({
    apply: applyLeaveRoute,
    getLeaves: getLeavesRoute,
    updateStatus: updateLeaveStatusRoute,
  }),
  toolbox: createTRPCRouter({
    getMeetings: getToolboxMeetingsRoute,
    acknowledgeMeeting: acknowledgeMeetingRoute,
    createMeeting: createToolboxMeetingRoute,
    updateMeeting: updateToolboxMeetingRoute,
    deleteMeeting: deleteToolboxMeetingRoute,
    upsertAttendee: upsertToolboxAttendeeRoute,
  }),
  payslips: createTRPCRouter({
    getPayslips: getPayslipsRoute,
    markViewed: markPayslipViewedRoute,
  }),
});

export type AppRouter = typeof appRouter;