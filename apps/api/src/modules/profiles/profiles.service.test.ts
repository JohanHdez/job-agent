/**
 * ProfilesService test stubs — Phase 2, Wave 0.
 * Implementation created in Plan 04 (schema + service) and Plan 05 (controller).
 * All tests are it.todo() here; they will be implemented after ProfilesService exists.
 */
describe('ProfilesService', () => {
  it.todo('PROF-01: importFromLinkedin returns partial summary with name+email when OIDC userinfo succeeds');
  it.todo('PROF-01: importFromLinkedin returns partial summary with missing list when LinkedIn API returns 403');
  it.todo('PROF-02: uploadCv calls runCvParser with buffer and upserts the profile');
  it.todo('PROF-03: patchProfile applies partial update and always includes userId in the filter');
  it.todo('PROF-04: checkCompleteness returns missing field names when skills and experience are empty');
  it.todo('NF-03: importFromLinkedin resolves in under 8000ms with mocked HTTP');
  it.todo('NF-08: every query method includes userId filter — no cross-user data access');
});
