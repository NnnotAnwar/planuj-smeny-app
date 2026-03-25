SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict eByLoTZviaF10PujApqdjr1ITfKfDbm53TOvhUcjz211vb2KgOyzHq5OQGSYwag

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

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
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '0efd87f8-9309-4d40-8d2d-1882e21365da', 'authenticated', 'authenticated', 'mario@pizza.com', '$2a$10$INPst58ZJo6QuyTfTWGUwOJNlOD2U2EFk86tB0HJzjOOmEnVi97v.', '2026-02-25 17:00:11.661134+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-04 23:04:31.830358+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-02-25 17:00:11.644747+00', '2026-03-04 23:04:31.836825+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'authenticated', 'authenticated', 'admin@admin.com', '$2a$10$70S9GVG8By6lPWjMgQzuw.Zs5jricPsP8PEVY4LnWPnv8w4K7Dw72', '2026-02-23 15:23:27.459049+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-24 01:51:55.750786+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-02-23 15:23:27.412948+00', '2026-03-24 12:14:11.978443+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', 'authenticated', 'authenticated', 'anuarkairulla@gmail.com', '$2a$10$A5a3q/rjwn9D5vSko.mBvOK5FiqUT6s5ZpsV5RrzFkDZwEQvOPmg2', '2026-02-23 22:05:49.66033+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-23 23:45:08.074799+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-02-23 22:05:49.635377+00', '2026-03-23 23:45:08.077608+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '{"sub": "e09fdc4c-b0ef-42cf-bded-82d5e9d52347", "email": "admin@admin.com", "email_verified": false, "phone_verified": false}', 'email', '2026-02-23 15:23:27.435537+00', '2026-02-23 15:23:27.436123+00', '2026-02-23 15:23:27.436123+00', 'ab8556b7-02df-4837-9693-00b12d306824'),
	('e3f94804-80d2-4d13-8dc8-ca19328fa004', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', '{"sub": "e3f94804-80d2-4d13-8dc8-ca19328fa004", "email": "anuarkairulla@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-02-23 22:05:49.655422+00', '2026-02-23 22:05:49.65548+00', '2026-02-23 22:05:49.65548+00', 'f19970e5-459c-4dc0-98e3-5b8a8ae6cdca'),
	('0efd87f8-9309-4d40-8d2d-1882e21365da', '0efd87f8-9309-4d40-8d2d-1882e21365da', '{"sub": "0efd87f8-9309-4d40-8d2d-1882e21365da", "email": "mario@pizza.com", "email_verified": false, "phone_verified": false}', 'email', '2026-02-25 17:00:11.655199+00', '2026-02-25 17:00:11.655258+00', '2026-02-25 17:00:11.655258+00', 'dfabe467-80c1-4c2a-881c-b41e75cb1974');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('05ac6c68-8a02-4c43-97a8-15b429b1a208', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2026-03-24 00:21:06.214454+00', '2026-03-24 00:21:06.214454+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '94.112.113.131', NULL, NULL, NULL, NULL, NULL),
	('715c6e47-96d6-4719-8a92-bcb1573ac014', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2026-03-24 00:55:01.283469+00', '2026-03-24 00:55:01.283469+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '94.112.113.131', NULL, NULL, NULL, NULL, NULL),
	('e9341331-24d9-4253-bddc-817ee3c0f49d', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2026-03-24 01:03:02.13559+00', '2026-03-24 09:09:57.740899+00', NULL, 'aal1', NULL, '2026-03-24 09:09:57.73885', 'Mozilla/5.0 (Linux; Android 16; SM-S921B Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36', '94.112.113.131', NULL, NULL, NULL, NULL, NULL),
	('a06e6188-f068-403f-977d-81c51924ba61', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2026-03-24 00:13:16.628741+00', '2026-03-24 11:15:26.903027+00', NULL, 'aal1', NULL, '2026-03-24 11:15:26.901844', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '147.33.130.14', NULL, NULL, NULL, NULL, NULL),
	('cbb94b6f-712d-4996-939c-50b770366477', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2026-03-24 01:51:55.750894+00', '2026-03-24 12:14:11.992508+00', NULL, 'aal1', NULL, '2026-03-24 12:14:11.990625', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)', '147.33.130.19', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('a06e6188-f068-403f-977d-81c51924ba61', '2026-03-24 00:13:16.671622+00', '2026-03-24 00:13:16.671622+00', 'password', '1c10bc17-b91a-4825-8d3f-12bd858b2c5b'),
	('05ac6c68-8a02-4c43-97a8-15b429b1a208', '2026-03-24 00:21:06.234638+00', '2026-03-24 00:21:06.234638+00', 'password', '76289d35-a40f-454c-bffe-dd2479f76028'),
	('715c6e47-96d6-4719-8a92-bcb1573ac014', '2026-03-24 00:55:01.334244+00', '2026-03-24 00:55:01.334244+00', 'password', '0859e334-c4db-46e7-8293-f36518230b6b'),
	('e9341331-24d9-4253-bddc-817ee3c0f49d', '2026-03-24 01:03:02.197042+00', '2026-03-24 01:03:02.197042+00', 'password', '24bd6474-4937-40f5-a34b-1b43173cccbb'),
	('cbb94b6f-712d-4996-939c-50b770366477', '2026-03-24 01:51:55.765628+00', '2026-03-24 01:51:55.765628+00', 'password', 'e423e6f6-6f46-4b9b-bd6e-c2c3339ae029');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 389, 'mlndhmi4nejx', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', false, '2026-03-24 00:21:06.227948+00', '2026-03-24 00:21:06.227948+00', NULL, '05ac6c68-8a02-4c43-97a8-15b429b1a208'),
	('00000000-0000-0000-0000-000000000000', 390, 'ndi7nzjc6nzr', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', false, '2026-03-24 00:55:01.310743+00', '2026-03-24 00:55:01.310743+00', NULL, '715c6e47-96d6-4719-8a92-bcb1573ac014'),
	('00000000-0000-0000-0000-000000000000', 388, 'm5ngwy6hteum', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 00:13:16.648505+00', '2026-03-24 01:47:39.095367+00', NULL, 'a06e6188-f068-403f-977d-81c51924ba61'),
	('00000000-0000-0000-0000-000000000000', 391, '6q7zxpqtbxv4', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 01:03:02.168658+00', '2026-03-24 08:09:31.607304+00', NULL, 'e9341331-24d9-4253-bddc-817ee3c0f49d'),
	('00000000-0000-0000-0000-000000000000', 394, '5j4bafaf73up', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 08:09:31.633211+00', '2026-03-24 09:09:57.67492+00', '6q7zxpqtbxv4', 'e9341331-24d9-4253-bddc-817ee3c0f49d'),
	('00000000-0000-0000-0000-000000000000', 395, '7opnavtudi42', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', false, '2026-03-24 09:09:57.707916+00', '2026-03-24 09:09:57.707916+00', '5j4bafaf73up', 'e9341331-24d9-4253-bddc-817ee3c0f49d'),
	('00000000-0000-0000-0000-000000000000', 392, 'hdo5euvra5b6', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 01:47:39.112326+00', '2026-03-24 09:52:56.69118+00', 'm5ngwy6hteum', 'a06e6188-f068-403f-977d-81c51924ba61'),
	('00000000-0000-0000-0000-000000000000', 396, 'kmw6afiza3s7', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 09:52:56.712381+00', '2026-03-24 11:15:26.823995+00', 'hdo5euvra5b6', 'a06e6188-f068-403f-977d-81c51924ba61'),
	('00000000-0000-0000-0000-000000000000', 397, 'jtndjyczkonf', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', false, '2026-03-24 11:15:26.862767+00', '2026-03-24 11:15:26.862767+00', 'kmw6afiza3s7', 'a06e6188-f068-403f-977d-81c51924ba61'),
	('00000000-0000-0000-0000-000000000000', 393, 'nic6mzybewi7', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', true, '2026-03-24 01:51:55.762778+00', '2026-03-24 12:14:11.938709+00', NULL, 'cbb94b6f-712d-4996-939c-50b770366477'),
	('00000000-0000-0000-0000-000000000000', 398, 'ndefhuqbuaau', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', false, '2026-03-24 12:14:11.964064+00', '2026-03-24 12:14:11.964064+00', 'nic6mzybewi7', 'cbb94b6f-712d-4996-939c-50b770366477');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."organizations" ("id", "created_at", "name", "slug") VALUES
	('ef0a0b4c-7876-4c38-b10d-210d2abd096c', '2026-02-25 16:29:05.600852+00', 'My Default Restaurant', 'default-org'),
	('19692666-6f9a-49ac-81e0-e40d1a980ab8', '2026-02-25 16:58:08.331625+00', 'Luigi Pizzeria', 'pizzeria');


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."locations" ("id", "name", "created_at", "organization_id") VALUES
	('2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', 'San Carlo - Dittrichova', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('348898a0-fabb-4ba5-aa79-961a4c9aa9b2', 'San Carlo - Malá Strana', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('c5868d35-6c34-48f9-9d10-7ab77fdbe043', 'San Carlo - Vinohrady', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('64b637f7-c2ac-4a5e-9f95-91a60c159024', 'San Carlo - Karlín', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('b4f97c90-e6d9-400b-a74c-f8018d65b325', 'San Carlo - Letna', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('109cf650-57c7-4860-bc30-b1e3975bd2a0', 'San Carlo - Holešovice', '2026-02-23 13:22:29.772417+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c'),
	('26828f6e-ef12-47d8-b3ac-1688a5fec748', 'Main Hall (Pizza)', '2026-02-25 16:59:01.121535+00', '19692666-6f9a-49ac-81e0-e40d1a980ab8'),
	('169c953a-3e64-453f-8322-fa911f82fd0c', 'Delivery Zone', '2026-02-25 16:59:01.121535+00', '19692666-6f9a-49ac-81e0-e40d1a980ab8');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "role", "created_at", "email", "username", "organization_id", "first_name", "last_name") VALUES
	('0efd87f8-9309-4d40-8d2d-1882e21365da', 'Supervisor', '2026-02-25 17:02:17.525854+00', 'mario@pizza.com', 'mario', '19692666-6f9a-49ac-81e0-e40d1a980ab8', 'Mario', 'Giorno'),
	('e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'Admin', '2026-02-23 21:09:11.999005+00', 'admin@admin.com', 'admin', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', NULL),
	('e3f94804-80d2-4d13-8dc8-ca19328fa004', 'Manager', '2026-02-23 22:06:37.868402+00', 'anuarkairulla@gmail.com', 'anwar', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Anuar', 'Kairulla');


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."shifts" ("id", "user_id", "location_id", "started_at", "ended_at", "created_at", "organization_id", "role", "previous_location_id") VALUES
	('5e2c4b01-8938-4af7-b0c6-912cda580b3b', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2', '2026-03-24 00:13:23.435+00', '2026-03-24 00:13:33.938+00', '2026-03-24 00:13:23.557421+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5'),
	('acda23bd-5b38-477a-a289-2ee36e46f1fc', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-20 14:56:59.877+00', NULL, '2026-03-20 14:56:59.960671+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Manager', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2'),
	('2a5e89fe-6d0a-488f-9f55-5bf507ae3577', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-19 16:40:30.601+00', '2026-03-19 16:40:56.113+00', '2026-03-19 16:40:30.855898+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5'),
	('9eedf4fd-c359-44c4-8ab4-bc4c09321714', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-24 00:13:41.75+00', '2026-03-24 00:22:28.315+00', '2026-03-24 00:13:41.950223+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2'),
	('e95c80f5-5a64-4475-847d-9a3cd0289f8a', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2', '2026-03-19 16:41:16.378+00', '2026-03-19 16:57:49.652+00', '2026-03-19 16:41:16.459425+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Manager', '64b637f7-c2ac-4a5e-9f95-91a60c159024'),
	('6d2f597f-4d8b-4ef5-a655-cd36722fed9b', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-19 16:40:59.078+00', '2026-03-19 16:59:05.585+00', '2026-03-19 16:40:59.151647+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2'),
	('f4a70d07-c0d8-44b1-8d50-2a1e5b7ab567', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-24 00:22:36.53+00', '2026-03-24 00:39:56.596+00', '2026-03-24 00:22:36.717831+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '64b637f7-c2ac-4a5e-9f95-91a60c159024'),
	('3f6e83d7-8dbf-4353-ac10-da50d62c895e', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-24 00:40:00.463+00', '2026-03-24 00:43:44.513+00', '2026-03-24 00:40:00.552917+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', NULL),
	('ff6efaa7-2c12-4e06-842b-445a0819f588', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2', '2026-03-19 17:09:27.618+00', '2026-03-20 09:51:46.053+00', '2026-03-19 17:09:27.71027+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Manager', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5'),
	('fce69299-0236-4f6c-8aec-fafcfda9d687', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', '348898a0-fabb-4ba5-aa79-961a4c9aa9b2', '2026-03-20 09:51:51.274+00', '2026-03-20 09:52:02.06+00', '2026-03-20 09:51:51.415565+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Manager', NULL),
	('872e693f-1efb-45dc-9227-293e306275b1', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-24 00:43:47.165+00', '2026-03-24 00:45:29.123+00', '2026-03-24 00:43:47.255008+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '64b637f7-c2ac-4a5e-9f95-91a60c159024'),
	('c67da7c1-ed52-46c9-b25c-b57cc342f863', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '109cf650-57c7-4860-bc30-b1e3975bd2a0', '2026-03-19 17:00:56.854+00', '2026-03-20 09:53:43.475+00', '2026-03-19 17:00:56.978367+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', 'b4f97c90-e6d9-400b-a74c-f8018d65b325'),
	('e8a646e0-a96b-4456-83d8-ef87f8687c4d', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-20 09:53:50.365+00', '2026-03-20 09:53:56.048+00', '2026-03-20 09:53:50.538277+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', 'b4f97c90-e6d9-400b-a74c-f8018d65b325'),
	('43bf6d81-e33b-460b-966e-c41875f4dd6d', 'e3f94804-80d2-4d13-8dc8-ca19328fa004', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-20 09:52:09.77+00', '2026-03-20 14:48:38.68+00', '2026-03-20 09:52:09.846994+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Manager', NULL),
	('c3238746-b8af-4fe5-b84f-094b058fbb28', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043', '2026-03-24 00:45:32.441+00', '2026-03-24 00:55:18.776+00', '2026-03-24 00:45:32.545116+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '109cf650-57c7-4860-bc30-b1e3975bd2a0'),
	('5235b3d2-18af-4b52-b3a9-410e6e83af1b', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '109cf650-57c7-4860-bc30-b1e3975bd2a0', '2026-03-20 14:48:57.164+00', '2026-03-22 09:43:01.209+00', '2026-03-20 14:48:57.29292+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', 'b4f97c90-e6d9-400b-a74c-f8018d65b325'),
	('81f9590e-0cb1-4c01-a75a-e46929bf8ebd', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '109cf650-57c7-4860-bc30-b1e3975bd2a0', '2026-03-22 09:43:10.331+00', '2026-03-22 09:43:17.147+00', '2026-03-22 09:43:10.111714+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', NULL),
	('61914bb1-e62c-4f4b-b2ee-213c373ceac4', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-22 09:43:25.655+00', '2026-03-23 23:43:14.63+00', '2026-03-22 09:43:25.321451+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '109cf650-57c7-4860-bc30-b1e3975bd2a0'),
	('4921a991-acdb-46a0-ac06-215f378eb4ad', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', '2b3790a9-2c8c-4de8-a77a-7d80d2e938c5', '2026-03-24 00:55:21.596+00', '2026-03-24 01:03:07.581+00', '2026-03-24 00:55:21.602149+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', 'c5868d35-6c34-48f9-9d10-7ab77fdbe043'),
	('54974bc5-d13c-452b-b223-3d688b943cb0', 'e09fdc4c-b0ef-42cf-bded-82d5e9d52347', 'b4f97c90-e6d9-400b-a74c-f8018d65b325', '2026-03-24 01:03:10.81+00', NULL, '2026-03-24 01:03:10.878732+00', 'ef0a0b4c-7876-4c38-b10d-210d2abd096c', 'Admin', '109cf650-57c7-4860-bc30-b1e3975bd2a0');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 398, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict eByLoTZviaF10PujApqdjr1ITfKfDbm53TOvhUcjz211vb2KgOyzHq5OQGSYwag

RESET ALL;
