# Inventaire migrations V1 → V2

Ce fichier liste les migrations présentes dans la **V1** (`isna_app`), en **lecture seule**.
Ne pas modifier la V1 ; la V2 rejoue ou adapte ces scripts dans un **nouveau** projet Supabase.

## Ordre d'exécution recommandé

**Important :** l'ordre ci-dessous est l'ordre **lexicographique des noms de fichier** dans la V1 (approximation de l'historique). Ce n'est **pas** garanti comme ordre de dépendances FK : avant un port massif, valider avec `grep` / diagrammes ou rejouer sur une base vide avec corrections.

En pratique pour la V2 :

1. Appliquer d'abord les migrations **fondamentales V2** dédiées (`20250505_001_tenants.sql`, `20250505_002_access_passes.sql`, etc.) sur le projet neuf.
2. Ensuite rejouer les migrations V1 **une par une** ou les fusionner par domaine (billing, live, liri, …), en résolvant les conflits de nom (`update_updated_at`, policies dupliquées, etc.).

### Collision de préfixes dans la V1

Deux fichiers partagent le même préfixe horodaté `20260504140000_*` :

- `20260504140000_leads_email_unique_per_tenant.sql`
- `20260504140000_school_annual_program_rls_idempotent.sql`

Le CLI Supabase / les migrations locales supposent en général des noms uniques : lors du port, renommer l'un des deux pour éviter l'ambiguïté.

## Tables critiques (à cartographier pour la V2)

- `auth.users` (schéma Supabase Auth ; référencé par la plupart des tables métier)
- `profiles` (identité applicative, sync avec auth)
- Tables **billing** / licences / abonnements (`billing_*`, migrations `202603180*` etc.)
- **Live / immersive** (`live_sessions`, participants, enregistrements, smartboard, …)
- **LIRI / cours** (workspaces, versions, multilingue)
- **Booking / rendez-vous** (`appointment*`, `booking_*`)
- **Communities / coaching / school life**
- **Tenant / SaaS** : la V1 inclut `202604301700_isna_tenant.sql`, `20260503160000_saas_core_tenant_hosts_payment_live.sql`, etc. — à réconcilier avec le modèle `tenants` / `tenant_memberships` V2.

Les tables **à créer en V2** (hors replay V1) sont décrites dans `docs/CURSOR_INSTRUCTIONS.md` : `tenants`, `tenant_memberships`, `access_passes`, …

## Tables / domaines à ignorer, fusionner ou repenser au port

- Fonctionnalités expérimentales ou trop couplées à un tenant unique : décider domaine par domaine avec la roadmap V2 (`docs/ROADMAP_V2.md`).
- Seeds et données spécifiques prod (`*_seed_*`, profils nominatifs) : ne pas rejouer tels quels sur dev/staging.
- Politiques RLS réécrites plusieurs fois (hotfixes `*_rls_*`, `*_no_recursion_*`) : consolider en une passe dans la V2 pour réduire la dette.

## Liste complète des fichiers V1 (tri par nom)

Répertoire source : `isna_app/supabase/migrations/`.

1. `20250504_forum_complete.sql`
2. `20250505_marketing_tools.sql`
3. `20260315_knowledge_base.sql`
4. `20260317_enrollment_student_insert.sql`
5. `2026031801_billing_chariow_provider.sql`
6. `2026031802_billing_license_manual_activation.sql`
7. `2026031803_billing_logical_subscription_engine.sql`
8. `2026031804_billing_multi_payment.sql`
9. `2026031805_billing_one_time_formations.sql`
10. `2026031806_billing_provider_license_fields.sql`
11. `2026031807_billing_seed_plans.sql`
12. `2026031808_profiles_phone_country.sql`
13. `2026031809_teacher_role_pro_matrix.sql`
14. `2026031810_app_settings.sql`
15. `2026031901_seed_coaching_sessions.sql`
16. `2026031902_coaching_sessions_audit_logs.sql`
17. `2026032001_secretariat_coaching_contact.sql`
18. `2026032002_autonome_chariow_links.sql`
19. `2026032003_chariow_product_ids_by_interval.sql`
20. `2026032004_notifications_table_bootstrap.sql`
21. `20260321_team_invitations_privileged_links.sql`
22. `202603220001_booking_anti_double_reservation.sql`
23. `202603220002_appointment_session_flow.sql`
24. `202603220003_appointment_feedback.sql`
25. `202603220004_appointment_preparation.sql`
26. `202603220005_live_arena_complete.sql`
27. `202603220006_team_invitation_auto_accept.sql`
28. `20260323_secretariat_workflow.sql`
29. `20260324_communities.sql`
30. `20260325_appointments_rendez_vous.sql`
31. `202603260101_billing_secretariat_read.sql`
32. `202603260102_booking_live_system.sql`
33. `202603260103_france_gabon_secretariats.sql`
34. `202603271920_live_sessions_wizard_columns.sql`
35. `202603272001_billing_invoice_resend_tracking.sql`
36. `202603272002_classroom_live_extensions.sql`
37. `202603281200_live_invite_open_access.sql`
38. `202603281300_live_recordings_table.sql`
39. `202603282000_smart_entry_liri.sql`
40. `202603282100_live_script_sections_master_agent.sql`
41. `202603282201_live_session_invitations.sql`
42. `202603282202_student_reported_problems.sql`
43. `202603290010_live_studio_config.sql`
44. `202603290900_sprint1_signals_summaries.sql`
45. `202603300010_messages_delete_edit_rls.sql`
46. `202603300501_ngowazulu_chariow_shop_links.sql`
47. `20260331_live_recordings_storage.sql`
48. `20260401_live_chat_invites.sql`
49. `20260402_live_chat_invites_realtime.sql`
50. `202604030010_immersive_live_schema.sql`
51. `202604031400_secretariat_admin_documents.sql`
52. `202604032100_profiles_admin_mintsajohan.sql`
53. `202604040001_immersive_live_signals_cleanup.sql`
54. `202604040003_billing_invoice_and_membership_badges.sql`
55. `202604040004_student_realtime_academic_tables.sql`
56. `202604040501_immersive_live_signals.sql`
57. `202604040502_live_questions.sql`
58. `202604040503_live_script_sections.sql`
59. `202604040504_privileged_seats.sql`
60. `202604050501_course_builder_ai_extensions.sql`
61. `202604050502_course_builder_postprod_versions.sql`
62. `202604050503_live_session_summaries.sql`
63. `202604055010_live_webhook_events_immersive.sql`
64. `202604060001_prospect_and_student_onboarding.sql`
65. `202604060002_appointment_timezone_and_queue.sql`
66. `202604060003_secretariat_region_and_sla.sql`
67. `202604060004_smart_booking_engine_core.sql`
68. `202604060005_growth_engine.sql`
69. `202604060006_smart_response_engine.sql`
70. `202604060007_smart_response_library_seed.sql`
71. `202604060008_response_knowledge_base.sql`
72. `202604060009_immersive_navigation_analytics.sql`
73. `202604060010_ngowazulu_service_setup.sql`
74. `202604060011_ngowazulu_mentorat_duration.sql`
75. `202604060012_navigation_intelligence_engine.sql`
76. `202604060013_immersive_live_participants_realtime.sql`
77. `202604060014_live_immersive_production_platform.sql`
78. `202604060015_immersive_ambient_audio.sql`
79. `202604060016_live_scenes_staff_select.sql`
80. `20260407_ad_creatives.sql`
81. `20260408_school_life_records.sql`
82. `202604091200_liri_pedagogie_futur_paths.sql`
83. `202604091330_liri_formation_drafts.sql`
84. `202604091415_live_mobile_camera_tokens.sql`
85. `202604101800_designer_ia_images.sql`
86. `202604101930_longia_chat_threads.sql`
87. `202604102045_booking_contact_whatsapp.sql`
88. `202604111230_live_rls_reapply_policies_after_helpers.sql`
89. `202604151830_isna_pipeline_runs.sql`
90. `202604200001_live_sessions_rls_no_recursion.sql`
91. `202604200002_notifications_action_url_reschedule_requests.sql`
92. `202604210001_org_inbound_emails.sql`
93. `20260421_coaching_programs.sql`
94. `202604220001_integrated_mail_inbox.sql`
95. `202604221400_live_guest_permissions_and_notes.sql`
96. `202604230001_profiles_insert_own_for_signup.sql`
97. `202604240000_school_announcements_base_table.sql`
98. `202604240001_school_announcements_extended.sql`
99. `202604241200_live_guest_permission_active.sql`
100. `202604250003_ngowazulu_mentorat_commercial_names.sql`
101. `202604251200_live_joykit_signals_and_rpc.sql`
102. `202604271000_ngowazulu_mentorat_workshops.sql`
103. `202604271130_booking_channels_ngowazulu_split.sql`
104. `202604271300_ngowazulu_temple_core.sql`
105. `202604271530_public_reviews_app.sql`
106. `202604271545_public_reviews_anti_spam.sql`
107. `202604271910_messages_query_perf_indexes.sql`
108. `202604280900_ngowazulu_travel_registrations.sql`
109. `202604282120_live_sessions_join_code.sql`
110. `202604291200_live_neuronq_questions_create.sql`
111. `202604291400_live_participants_insert_teacher_inviter.sql`
112. `202604301200_neuro_recall_system.sql`
113. `202604301400_immersive_smartboard_shared_images.sql`
114. `202604301500_immersive_smartboard_scenes.sql`
115. `202604301600_cimolace_backend_tables.sql`
116. `202604301600_immersive_companion_tokens.sql`
117. `202604301700_debatecore_engine.sql`
118. `202604301700_isna_tenant.sql`
119. `202604301800_cimolace_backoffice_additions.sql`
120. `202604301800_debate_invitations.sql`
121. `202604301900_live_sessions_debate_link.sql`
122. `202604302010_live_sessions_drop_session_type_check.sql`
123. `202604302020_debate_arena_runtime.sql`
124. `202604302030_debate_votes.sql`
125. `202604302040_realtime_debate_publication.sql`
126. `202604302050_debate_round_prep.sql`
127. `202604302070_live_neuronq_debate_participants_read.sql`
128. `202604302080_debate_ai_reports.sql`
129. `202604302090_fix_live_sessions_read_and_storage_wizard.sql`
130. `202604302095_debate_rls_break_recursion.sql`
131. `202604302110_live_liri_rls_recursion_hotfix.sql`
132. `202604302120_live_participants_read_split_policies.sql`
133. `202604302130_live_regularite_profiles.sql`
134. `202604302200_immersive_live_forum_participants_rls.sql`
135. `202604302210_liri_modal_school_life_rls.sql`
136. `202604302220_liri_profiles_secretariat_no_recursion.sql`
137. `202604302230_user_has_role_bypass_profiles_rls.sql`
138. `202604302240_is_assigned_teacher_bypass_rls_profiles_teacher.sql`
139. `202604302250_profiles_email_sync_from_auth.sql`
140. `202604302260_profiles_admin_davidbadika.sql`
141. `202604302270_profiles_city_region_country_text.sql`
142. `202604302280_smartboard_canvas_storage.sql`
143. `202604302290_liri_course_workspaces.sql`
144. `202604302291_liri_course_workspace_shares_versions.sql`
145. `202604302292_liri_workspace_share_display_rpc.sql`
146. `202604302293_liri_workspace_versions_trim.sql`
147. `202604302294_liri_workspace_invites.sql`
148. `202604302295_liri_workspace_lifecycle_status.sql`
149. `202604302296_liri_vision_temp_storage.sql`
150. `202604302297_liri_vision_temp_ttl_rpc.sql`
151. `202604302301_smartboard_canvas_cinema_webm.sql`
152. `202604302311_school_paths_starts_on.sql`
153. `202604302312_liri_multilang_system.sql`
154. `202604302313_liri_multilang_video_translations.sql`
155. `202604302314_liri_multilang_live_captions.sql`
156. `202604302314_live_internal_helpers_row_security_off.sql`
157. `202604302320_live_communication_private_messages.sql`
158. `202604302325_live_session_proctor_camera_events.sql`
159. `202604302328_proctor_consent_ack_hardening.sql`
160. `202604302329_proctor_tables_realtime.sql`
161. `202604302331_lspm_rls_waiting_room_approved.sql`
162. `202604302332_proctor_cam_events_host_role.sql`
163. `202604302335_live_waiting_room_chat_lobby.sql`
164. `202604302400_live_start_notifications.sql`
165. `202604302410_live_start_whatsapp_messaging.sql`
166. `202604302415_guest_can_use_personal_notes.sql`
167. `202604302416_live_session_active_participant_count.sql`
168. `202605011200_cimolace_clients_portal_slug.sql`
169. `20260502210000_school_annual_program.sql`
170. `20260503120000_app_settings_public_contact_read.sql`
171. `202605031200_livekit_magic_links_used_at.sql`
172. `20260503130000_billing_processed_webhook_ids.sql`
173. `20260503140000_cron_locks.sql`
174. `20260503150000_live_recordings_tenant_slug.sql`
175. `20260503160000_saas_core_tenant_hosts_payment_live.sql`
176. `20260503170000_tenant_host_bindings_prorascience_zahir.sql`
177. `20260503180000_cimolace_platform_tenant_host.sql`
178. `20260503190000_payment_providers_paypal.sql`
179. `20260503200000_module_engine.sql`
180. `20260503210000_iri_pages_blocks.sql`
181. `20260503220000_live_extensions_tenant_id.sql`
182. `20260503230000_coaching_school_community_mailbox_tenant_id.sql`
183. `20260503_ai_generation_jobs_queue.sql`
184. `20260503_custom_jwt_claims.sql`
185. `20260503_leads_rls_security.sql`
186. `20260503_mfa_enrollment.sql`
187. `20260503_rate_limits.sql`
188. `20260503_session_version_revocation.sql`
189. `20260504000000_billing_paypal_provider.sql`
190. `20260504110000_billing_cron_cursors.sql`
191. `20260504110100_billing_webhook_dlq.sql`
192. `20260504120000_billing_webhook_dlq_unlimited_attempts.sql`
193. `20260504130000_leads_cimolace_tenant_id.sql`
194. `20260504140000_leads_email_unique_per_tenant.sql`
195. `20260504140000_school_annual_program_rls_idempotent.sql`
196. `20260504150000_leads_backfill_default_tenant.sql`
197. `20260504151000_marketing_tenant_id.sql`
198. `20260504152000_payment_failures_tenant_id.sql`
199. `20260504153000_school_annual_program_rls_tenant.sql`
200. `20260505120000_school_annual_program_unique_staff_update.sql`
201. `20260505130000_annual_program_school_path_link.sql`
202. `202605141030_booking_notification_consent.sql`
203. `202605141120_booking_sms_preference.sql`
204. `202605141200_liri_orchestrator_projects.sql`
