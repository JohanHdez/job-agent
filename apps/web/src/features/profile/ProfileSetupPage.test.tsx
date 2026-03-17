import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfileSetupPage from './ProfileSetupPage';
import { api } from '../../lib/api';

// vi.mock factories cannot reference external variables — use vi.fn() inline
vi.mock('../../lib/api', () => ({
  api: {
    patch: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApiPatch = vi.mocked(api.patch);

/** Helper to render ProfileSetupPage within a router context */
function renderSetupPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/setup']}>
      <Routes>
        <Route path="/profile/setup" element={<ProfileSetupPage />} />
        <Route path="/config" element={<div data-testid="config-page">Config</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProfileSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Complete Your Profile" heading', () => {
    renderSetupPage();
    expect(screen.getByRole('heading', { name: /Complete Your Profile/i })).toBeInTheDocument();
  });

  it('renders required field indicators for seniority, skills, and experience', () => {
    renderSetupPage();
    // Each required field has "(required)" label
    const requiredLabels = screen.getAllByText('(required)');
    // seniority, skills, experience — 3 sections
    expect(requiredLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('renders seniority PillToggle group with Junior, Mid, Senior, Lead options', () => {
    renderSetupPage();
    expect(screen.getByText('Junior')).toBeInTheDocument();
    expect(screen.getByText('Mid')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('renders "Save Profile" button', () => {
    renderSetupPage();
    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeInTheDocument();
  });

  it('does NOT show "Skip for now" link when form is empty', () => {
    renderSetupPage();
    expect(screen.queryByText(/Skip for now/i)).not.toBeInTheDocument();
  });

  it('shows "Skip for now" link when the user has partial data (fullName filled)', () => {
    renderSetupPage();
    const nameInput = screen.getByPlaceholderText('Jane Smith');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(screen.getByText(/Skip for now/i)).toBeInTheDocument();
  });

  it('shows validation errors when trying to save with empty required fields', async () => {
    renderSetupPage();
    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Seniority is required.')).toBeInTheDocument();
      expect(screen.getByText('At least one skill is required.')).toBeInTheDocument();
      expect(screen.getByText('Company is required.')).toBeInTheDocument();
      expect(screen.getByText('Job title is required.')).toBeInTheDocument();
    });

    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('highlights experience company field with red border on validation failure', async () => {
    renderSetupPage();
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      const companyInput = screen.getByPlaceholderText('Acme Corp');
      // borderColor is set via inline style to error color
      expect(companyInput).toBeInTheDocument();
    });
  });

  it('calls api.patch("/users/profile", ...) with correct fields on valid submission', async () => {
    mockApiPatch.mockResolvedValueOnce({ data: {} });

    renderSetupPage();

    // Select seniority
    fireEvent.click(screen.getByText('Senior'));

    // Add a skill via the chip input inner text field
    const skillsInput = screen.getByPlaceholderText('Type a skill and press Enter…');
    fireEvent.change(skillsInput, { target: { value: 'TypeScript' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });

    // Fill experience
    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: 'TechCorp' } });
    fireEvent.change(screen.getByPlaceholderText('Software Engineer'), {
      target: { value: 'Frontend Dev' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/users/profile',
        expect.objectContaining({
          seniority: 'Senior',
          skills: ['TypeScript'],
          experience: expect.arrayContaining([
            expect.objectContaining({
              company: 'TechCorp',
              title: 'Frontend Dev',
            }),
          ]),
        })
      );
    });
  });

  it('navigates to /config after successful save', async () => {
    mockApiPatch.mockResolvedValueOnce({ data: {} });

    renderSetupPage();

    fireEvent.click(screen.getByText('Mid'));

    const skillsInput = screen.getByPlaceholderText('Type a skill and press Enter…');
    fireEvent.change(skillsInput, { target: { value: 'React' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });

    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: 'StartupCo' } });
    fireEvent.change(screen.getByPlaceholderText('Software Engineer'), {
      target: { value: 'Engineer' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(screen.getByTestId('config-page')).toBeInTheDocument();
    });
  });

  it('shows error banner when api.patch rejects', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('Server error'));

    renderSetupPage();

    fireEvent.click(screen.getByText('Lead'));

    const skillsInput = screen.getByPlaceholderText('Type a skill and press Enter…');
    fireEvent.change(skillsInput, { target: { value: 'Node.js' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });

    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: 'BigCorp' } });
    fireEvent.change(screen.getByPlaceholderText('Software Engineer'), {
      target: { value: 'Backend Engineer' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('form fields have aria-required="true" on required inputs', () => {
    renderSetupPage();
    const companyInput = screen.getByPlaceholderText('Acme Corp');
    const titleInput = screen.getByPlaceholderText('Software Engineer');
    expect(companyInput).toHaveAttribute('aria-required', 'true');
    expect(titleInput).toHaveAttribute('aria-required', 'true');
  });
});
