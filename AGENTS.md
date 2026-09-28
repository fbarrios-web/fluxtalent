
- Vacancy-level access: users with org_member_access.all_vacancies=false only see vacancies/applications assigned in vacancy_assignees (enforced by RLS via can_access_vacancy); no row = full access. Why: Enterprise/Custom orgs (Freddo) assign users to specific vacancies.
