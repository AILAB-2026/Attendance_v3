--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.0

-- Started on 2024-12-20 01:32:01

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
-- TOC entry 4862 (class 1262 OID 16388)
-- Name: attendance; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE attendance WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_Singapore.936';


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
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    is_ot boolean DEFAULT false NOT NULL,
    created_date timestamp without time zone DEFAULT now(),
    created_by character varying
);


ALTER TABLE public.attendance_activities OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16394)
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
-- TOC entry 220 (class 1259 OID 16426)
-- Name: attendance_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_roles (
    role_id integer NOT NULL,
    role_name character varying NOT NULL
);


ALTER TABLE public.attendance_roles OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16408)
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
-- TOC entry 4853 (class 0 OID 16389)
-- Dependencies: 217
-- Data for Name: attendance_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (16, 'user@gmail.com', '2024-12-19 22:47:58.329187+08', NULL, false, '2024-12-19 22:47:58.329187', 'user@gmail.com');
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (17, 'manager@gmail.com', '2024-12-19 22:52:50.556195+08', NULL, false, '2024-12-19 22:52:50.556195', 'manager@gmail.com');
INSERT INTO public.attendance_activities OVERRIDING SYSTEM VALUE VALUES (18, 'user@gmail.com', '2024-12-19 23:01:52.731569+08', '2024-12-19 23:01:54.323898+08', false, '2024-12-19 23:01:52.731569', 'user@gmail.com');


--
-- TOC entry 4856 (class 0 OID 16426)
-- Dependencies: 220
-- Data for Name: attendance_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_roles VALUES (1, 'User');
INSERT INTO public.attendance_roles VALUES (3, 'Admin');
INSERT INTO public.attendance_roles VALUES (2, 'Manager');


--
-- TOC entry 4855 (class 0 OID 16408)
-- Dependencies: 219
-- Data for Name: attendance_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.attendance_users OVERRIDING SYSTEM VALUE VALUES ('user@gmail.com', NULL, NULL, true, 1);
INSERT INTO public.attendance_users OVERRIDING SYSTEM VALUE VALUES ('manager@gmail.com', NULL, NULL, true, 2);


--
-- TOC entry 4863 (class 0 OID 0)
-- Dependencies: 218
-- Name: attendance_activities_nid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_activities_nid_seq', 18, true);


--
-- TOC entry 4704 (class 2606 OID 16415)
-- Name: attendance_users attendance_users_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_users
    ADD CONSTRAINT attendance_users_unique UNIQUE (email);


--
-- TOC entry 4706 (class 2606 OID 16432)
-- Name: attendance_roles newtable_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_roles
    ADD CONSTRAINT newtable_pk PRIMARY KEY (role_id);


--
-- TOC entry 4707 (class 2606 OID 16433)
-- Name: attendance_users attendance_users_attendance_roles_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_users
    ADD CONSTRAINT attendance_users_attendance_roles_fk FOREIGN KEY (role_id) REFERENCES public.attendance_roles(role_id);


-- Completed on 2024-12-20 01:32:01

--
-- PostgreSQL database dump complete
--

