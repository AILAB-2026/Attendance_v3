-- DROP FUNCTION public.enroll_or_update_user(in text, in text, in jsonb, out numeric, out text);

CREATE OR REPLACE FUNCTION public.enroll_or_update_user(p_employee_id text, p_customer_id text, p_face_descriptor jsonb, OUT status_code numeric, OUT message text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
BEGIN

  UPDATE attendance_users
  SET
    face_descriptor = p_face_descriptor
  WHERE employee_id = p_employee_id
	and customer_id=p_customer_id
	;
	status_code := 0; -- Success
	message := 'Face enrolled successfully';
END;
$function$
;