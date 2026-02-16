--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2024-12-23 03:20:42

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4808 (class 1262 OID 16388)
-- Name: attendance; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE attendance WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_Singapore.1252';


ALTER DATABASE attendance OWNER TO postgres;

\connect attendance

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 16389)
-- Name: attendance_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_activities (
    nid integer NOT NULL,
    email character varying,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    is_ot boolean DEFAULT false NOT NULL,
    created_date timestamp without time zone DEFAULT now(),
    created_by character varying,
    start_loc_lat numeric,
    start_loc_long numeric,
    start_loc_name character varying,
    end_loc_lat numeric,
    end_loc_long numeric,
    end_loc_name character varying
);


ALTER TABLE public.attendance_activities OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16396)
-- Name: attendance_activities_nid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_activities ALTER COLUMN nid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.attendance_activities_nid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 219 (class 1259 OID 16397)
-- Name: attendance_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_roles (
    role_id integer NOT NULL,
    role_name character varying NOT NULL
);


ALTER TABLE public.attendance_roles OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16402)
-- Name: attendance_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_users (
    email character varying,
    password character varying,
    guid character varying,
    is_active boolean DEFAULT false NOT NULL,
    role_id integer
);


ALTER TABLE public.attendance_users OWNER TO postgres;

--
-- TOC entry 4799 (class 0 OID 16389)
-- Dependencies: 217
-- Data for Name: attendance_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (17, 'manager@gmail.com', '2024-12-19 22:52:50.556195', '2024-12-21 00:48:15.506632', false, '2024-12-19 22:52:50.556195', 'manager@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (20, 'user@gmail.com', '2024-12-21 12:08:09.966', '2024-12-21 22:08:12.401889', false, '2024-12-21 22:08:09.966473', 'user@gmail.com', 1.3531439, 103.8491907, 'Bishan Street 14', 1.3531439, 103.8491907, 'Bishan Street 14');
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (23, 'user@gmail.com', '2024-12-19 00:00:00', '2024-12-19 05:00:00', true, '2024-12-21 23:01:36.682711', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (24, 'user@gmail.com', '2024-12-18 00:00:00', '2024-12-18 05:00:00', true, '2024-12-21 23:01:58.815219', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (25, 'user@gmail.com', '2024-12-17 00:00:00', '2024-12-17 05:00:00', true, '2024-12-21 23:10:54.012216', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (26, 'user@gmail.com', '2024-12-16 00:00:00', '2024-12-16 05:00:00', true, '2024-12-21 23:11:16.213399', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (27, 'user@gmail.com', '2024-12-15 00:00:00', '2024-12-15 05:00:00', true, '2024-12-21 23:13:45.247269', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (28, 'user@gmail.com', '2024-12-19 00:00:00', '2024-12-19 05:30:00', true, '2024-12-21 23:47:07.74325', 'user@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (21, 'user@gmail.com', '2024-12-20 10:30:22.814', '2024-12-20 22:11:36.796', false, '2024-12-21 22:11:22.814836', 'user@gmail.com', 1.3531439, 103.8491907, 'Bishan Street 14', 1.3531439, 103.8491907, 'Bishan Street 14');


--
-- TOC entry 4801 (class 0 OID 16397)
-- Dependencies: 219
-- Data for Name: attendance_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_roles VALUES (1, 'User');
INSERT INTO public.attendance_roles VALUES (3, 'Admin');
INSERT INTO public.attendance_roles VALUES (2, 'Manager');


--
-- TOC entry 4802 (class 0 OID 16402)
-- Dependencies: 220
-- Data for Name: attendance_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_users VALUES ('user@gmail.com', NULL, NULL, true, 1);
INSERT INTO public.attendance_users VALUES ('manager@gmail.com', NULL, NULL, true, 2);


--
-- TOC entry 4809 (class 0 OID 0)
-- Dependencies: 218
-- Name: attendance_activities_nid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_activities_nid_seq', 28, true);


--
-- TOC entry 4652 (class 2606 OID 16409)
-- Name: attendance_users attendance_users_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_users
    ADD CONSTRAINT attendance_users_unique UNIQUE (email);


--
-- TOC entry 4650 (class 2606 OID 16411)
-- Name: attendance_roles newtable_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_roles
    ADD CONSTRAINT newtable_pk PRIMARY KEY (role_id);


--
-- TOC entry 4653 (class 2606 OID 16412)
-- Name: attendance_users attendance_users_attendance_roles_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_users
    ADD CONSTRAINT attendance_users_attendance_roles_fk FOREIGN KEY (role_id) REFERENCES public.attendance_roles(role_id);


-- Completed on 2024-12-23 03:20:43

--
-- PostgreSQL database dump complete
--

