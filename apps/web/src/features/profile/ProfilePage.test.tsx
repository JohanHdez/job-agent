import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { api } from '../../lib/api';

// vi.mock factories cannot reference external variables — use vi.fn() inline
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApiGet = vi.mocked(api.get);
const mockApiPatch = vi.mocked(api.patch);
const mockApiPost = vi.mocked(api.post);

const mockProfile = {
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  phone: '+1 555-0100',
  location: 'Remote',
  linkedinUrl: '',
  headline: 'Senior Software Engineer',
  summary: 'Experienced engineer.',
  seniority: 'Senior' as const,
  yearsOfExperience: 5,
  skills: ['TypeScript', 'React'],
  techStack: ['Node.js'],
  languages: [{ name: 'English', level: 'Native' as const }],
  experience: [
    {
      company: 'TechCorp',
      title: 'Engineer',
      startDate: '2020-01',
      endDate: '2023-01',
      description: [],
      technologies: [],
    },
  ],
  education: [],
};

/** Render ProfilePage in a router context */
function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/setup" element={<div data-testid="setup-page">Setup</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (default)', () => {
    it('renders "Edit Profile" button when profile is loaded', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
      });
    });

    it('does NOT render edit form inputs in view mode', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
    });
  });

  describe('edit mode toggle', () => {
    it('clicking "Edit Profile" toggles to edit mode and shows "Save Changes" button', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    it('clicking "Discard Changes" in header returns to view mode', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      // In edit mode there are two Discard Changes — header link and form button
      const discardButtons = screen.getAllByText(/Discard Changes/i);
      fireEvent.click(discardButtons[0]);

      // Back to view mode: Edit Profile button reappears
      expect(await screen.findByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
    });

    it('isEditing state: "Save Changes" button is present when editing', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      // isEditing is true — Save Changes CTA is visible
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  describe('incomplete profile banner (PROF-04)', () => {
    it('renders amber banner with role="alert" when missingFields is non-empty', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: {
          profile: mockProfile,
          isComplete: false,
          missingFields: ['skills', 'seniority'],
        },
      });

      renderProfilePage();

      const banner = await screen.findByRole('alert');
      expect(banner).toBeInTheDocument();
    });

    it('banner contains the missing field names', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: {
          profile: mockProfile,
          isComplete: false,
          missingFields: ['headline', 'skills'],
        },
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/Your profile is missing:/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/headline, skills/i)).toBeInTheDocument();
    });

    it('banner has amber background style (rgba(245,158,11,0.08))', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: {
          profile: mockProfile,
          isComplete: false,
          missingFields: ['skills'],
        },
      });

      renderProfilePage();

      const banner = await screen.findByRole('alert');
      expect(banner).toHaveStyle({ backgroundColor: 'rgba(245,158,11,0.08)' });
    });

    it('does NOT render banner when missingFields is empty', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      // Wait for load to complete
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('"Complete profile" link in banner navigates to /profile/setup', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: {
          profile: mockProfile,
          isComplete: false,
          missingFields: ['skills'],
        },
      });

      renderProfilePage();

      const link = await screen.findByText('Complete profile');
      fireEvent.click(link);

      await waitFor(() => {
        expect(screen.getByTestId('setup-page')).toBeInTheDocument();
      });
    });
  });

  describe('save profile edit', () => {
    it('calls api.patch("/users/profile", ...) with edited fields on save', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      const updatedProfile = { ...mockProfile, fullName: 'Jane Updated' };
      mockApiPatch.mockResolvedValueOnce({ data: { profile: updatedProfile } });
      // Refresh call after save
      mockApiGet.mockResolvedValueOnce({
        data: { profile: updatedProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      // Enter edit mode
      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      // Change the name field
      const nameInput = screen.getByDisplayValue('Jane Smith');
      fireEvent.change(nameInput, { target: { value: 'Jane Updated' } });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockApiPatch).toHaveBeenCalledWith(
          '/users/profile',
          expect.objectContaining({ fullName: 'Jane Updated' })
        );
      });
    });

    it('exits edit mode after successful save', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      const updatedProfile = { ...mockProfile };
      mockApiPatch.mockResolvedValueOnce({ data: { profile: updatedProfile } });
      mockApiGet.mockResolvedValueOnce({
        data: { profile: updatedProfile, isComplete: true, missingFields: [] },
      });

      renderProfilePage();

      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
      });
    });
  });

  describe('CV upload (CvDropzone)', () => {
    it('calls api.post("/users/profile/cv", formData) when a file is dropped', async () => {
      mockApiGet.mockResolvedValueOnce({
        data: { profile: mockProfile, isComplete: true, missingFields: [] },
      });

      const uploadResponse = {
        profile: { ...mockProfile, headline: 'Updated headline' },
        isComplete: true,
        missingFields: [],
      };
      mockApiPost.mockResolvedValueOnce({ data: uploadResponse });

      renderProfilePage();

      // Open the dropzone
      const importBtn = await screen.findByRole('button', { name: /Import CV/i });
      fireEvent.click(importBtn);

      // Simulate dropping a PDF file onto the dropzone
      const dropzone = screen.getByRole('button', { name: /Upload CV/i });
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });
      const dropEvent = {
        dataTransfer: { files: [file] },
      };

      fireEvent.drop(dropzone, dropEvent);

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          '/users/profile/cv',
          expect.any(FormData)
        );
      });
    });
  });
});
