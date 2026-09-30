
- Vacancy-level access: users with org_member_access.all_vacancies=false only see vacancies/applications assigned in vacancy_assignees (enforced by RLS via can_access_vacancy); no row = full access. Why: Enterprise/Custom orgs (Freddo) assign users to specific vacancies.
- In-person group interviews: `organizations.custom_features.in_person_interviews` switches agenda to group slots (`availability_slots.capacity/booked_count/location/location_url`); reserve_slot/release_slot keep counts atomic. Why: Freddo runs presential group interviews without video calls.
- Age is derived from the org's date-type sensitive field whose label contains "nac" (src/lib/age.ts). Why: no dedicated birth-date column.
