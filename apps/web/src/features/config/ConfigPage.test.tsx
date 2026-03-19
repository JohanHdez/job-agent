import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConfigPage from './ConfigPage';
import { api } from '../../lib/api';

// vi.mock factories cannot reference external variables — use vi.fn() inline
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApiGet = vi.mocked(api.get);
const mockApiPost = vi.mocked(api.post);
const mockApiPatch = vi.mocked(api.patch);
const mockApiDelete = vi.mocked(api.delete);

const mockPresets = [
  {
    id: 'preset-1',
    name: 'Remote TypeScript Jobs',
    keywords: ['TypeScript', 'React'],
    location: 'Remote',
    modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
    platforms: ['linkedin'],
    seniority: ['Senior'],
    languages: ['English'],
    datePosted: 'past_week' as const,
    minScoreToApply: 75,
    maxApplicationsPerSession: 10,
    excludedCompanies: [],
  },
  {
    id: 'preset-2',
    name: 'Backend Engineer EU',
    keywords: ['Node.js', 'NestJS'],
    location: 'Europe',
    modality: ['Hybrid'] as ('Remote' | 'Hybrid' | 'On-site')[],
    platforms: ['linkedin'],
    seniority: ['Mid', 'Senior'],
    languages: ['English', 'Spanish'],
    datePosted: 'past_week' as const,
    minScoreToApply: 70,
    maxApplicationsPerSession: 5,
    excludedCompanies: [],
  },
];

const mockConfig = {
  search: {
    keywords: [],
    location: 'Remote',
    modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
    languages: ['English'],
    seniority: ['Mid'],
    datePosted: 'past_week' as const,
    excludedCompanies: [],
    platforms: ['linkedin'],
    maxJobsToFind: 100,
  },
  matching: { minScoreToApply: 70, maxApplicationsPerSession: 10 },
  coverLetter: { language: 'en' as const, tone: 'professional' as const },
  report: { format: 'both' as const },
};

/** Render ConfigPage in a router context */
function renderConfigPage() {
  return render(
    <MemoryRouter>
      <ConfigPage />
    </MemoryRouter>
  );
}

describe('ConfigPage — preset management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: config, profile, and presets all load fine
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/config') {
        return Promise.resolve({ data: { config: mockConfig } });
      }
      if (url === '/users/profile') {
        return Promise.resolve({
          data: { profile: null, isComplete: true, missingFields: [] },
        });
      }
      if (url === '/users/presets') {
        return Promise.resolve({ data: mockPresets });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('on mount: calls GET /users/presets and renders returned presets', async () => {
    renderConfigPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/presets');
    });

    await waitFor(() => {
      // Presets appear in both the select option and the list span — use getAllByText
      expect(screen.getAllByText('Remote TypeScript Jobs').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Backend Engineer EU').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('"Save Preset" button calls POST /users/presets with preset name and current config values', async () => {
    const newPreset = { id: 'preset-3', name: 'New Preset', keywords: [], location: 'Remote', modality: ['Remote'], platforms: ['linkedin'], seniority: ['Mid'], languages: ['English'], datePosted: 'past_week', minScoreToApply: 70, maxApplicationsPerSession: 10, excludedCompanies: [] };
    mockApiPost.mockResolvedValueOnce({ data: newPreset });

    renderConfigPage();

    // Wait for presets to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/presets');
    });

    // Enter preset name
    const nameInput = screen.getByPlaceholderText('Name this preset...');
    fireEvent.change(nameInput, { target: { value: 'New Preset' } });

    // Click Save Preset
    const saveBtn = screen.getByRole('button', { name: /Save Preset/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/users/presets',
        expect.objectContaining({ name: 'New Preset' })
      );
    });
  });

  it('when 5 presets exist: "Save Preset" button is disabled and warning text is visible', async () => {
    const fivePresets = Array.from({ length: 5 }, (_, i) => ({
      ...mockPresets[0],
      id: `preset-${i + 1}`,
      name: `Preset ${i + 1}`,
    }));

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/config') return Promise.resolve({ data: { config: mockConfig } });
      if (url === '/users/profile') return Promise.resolve({ data: { profile: null, isComplete: true, missingFields: [] } });
      if (url === '/users/presets') return Promise.resolve({ data: fivePresets });
      return Promise.resolve({ data: null });
    });

    renderConfigPage();

    await waitFor(() => {
      // Preset names appear in both the select option and list — use getAllByText
      expect(screen.getAllByText('Preset 1').length).toBeGreaterThanOrEqual(1);
    });

    const saveBtn = screen.getByRole('button', { name: /Save Preset/i });
    expect(saveBtn).toBeDisabled();

    expect(
      screen.getByText(/Maximum 5 presets reached. Delete one to save a new preset./i)
    ).toBeInTheDocument();
  });

  it('when fewer than 5 presets: warning text is NOT rendered', async () => {
    renderConfigPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/presets');
    });

    expect(
      screen.queryByText(/Maximum 5 presets reached/i)
    ).not.toBeInTheDocument();
  });

  it('"Activate Preset" button calls PATCH /users/presets/active with correct presetId', async () => {
    mockApiPatch.mockResolvedValueOnce({ data: {} });

    renderConfigPage();

    // Wait for presets to be rendered in list (not just the dropdown)
    await waitFor(() => {
      const activateBtns = screen.queryAllByRole('button', { name: /Activate Preset/i });
      expect(activateBtns.length).toBeGreaterThan(0);
    });

    const activateButtons = screen.getAllByRole('button', { name: /Activate Preset/i });
    fireEvent.click(activateButtons[0]);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/users/presets/active', { presetId: 'preset-1' });
    });
  });

  it('after activating, "Activate Preset" button disappears for that preset (active highlight)', async () => {
    mockApiPatch.mockResolvedValueOnce({ data: {} });

    renderConfigPage();

    await waitFor(() => {
      const activateBtns = screen.queryAllByRole('button', { name: /Activate Preset/i });
      expect(activateBtns.length).toBeGreaterThan(0);
    });

    const initialCount = screen.getAllByRole('button', { name: /Activate Preset/i }).length;
    const activateButtons = screen.getAllByRole('button', { name: /Activate Preset/i });
    fireEvent.click(activateButtons[0]);

    await waitFor(() => {
      // After activation, the clicked preset no longer shows the Activate button
      expect(screen.getAllByRole('button', { name: /Activate Preset/i })).toHaveLength(initialCount - 1);
    });
  });

  it('clicking delete icon shows inline confirmation with "Delete Preset" and "Keep Preset" buttons', async () => {
    renderConfigPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Delete Remote TypeScript Jobs preset/i })).toBeInTheDocument();
    });

    // Click delete for the first preset
    const deleteBtn = screen.getByRole('button', { name: /Delete Remote TypeScript Jobs preset/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('button', { name: /Delete Preset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep Preset/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Delete preset.*This cannot be undone/i)
    ).toBeInTheDocument();
  });

  it('confirming delete calls api.delete with correct presetId', async () => {
    mockApiDelete.mockResolvedValueOnce({ data: {} });

    renderConfigPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Delete Remote TypeScript Jobs preset/i })).toBeInTheDocument();
    });

    // Click delete icon
    const deleteBtn = screen.getByRole('button', { name: /Delete Remote TypeScript Jobs preset/i });
    fireEvent.click(deleteBtn);

    // Confirm delete
    const confirmBtn = screen.getByRole('button', { name: /Delete Preset/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/users/presets/preset-1');
    });
  });

  it('"Keep Preset" cancels the confirmation without calling api.delete', async () => {
    renderConfigPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Delete Remote TypeScript Jobs preset/i })).toBeInTheDocument();
    });

    // Click delete icon
    const deleteBtn = screen.getByRole('button', { name: /Delete Remote TypeScript Jobs preset/i });
    fireEvent.click(deleteBtn);

    // Keep preset (cancel)
    const keepBtn = screen.getByRole('button', { name: /Keep Preset/i });
    fireEvent.click(keepBtn);

    expect(mockApiDelete).not.toHaveBeenCalled();
    // Preset should still be in the list (use getAllByText since it appears in select + list)
    expect(screen.getAllByText('Remote TypeScript Jobs').length).toBeGreaterThan(0);
  });

  it('preset section contains "Load Preset" button', async () => {
    renderConfigPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Load Preset/i })).toBeInTheDocument();
    });
  });

  it('after successful save, shows "Preset saved." message', async () => {
    const newPreset = { id: 'preset-new', name: 'My Preset', keywords: [], location: 'Remote', modality: ['Remote'], platforms: ['linkedin'], seniority: ['Mid'], languages: ['English'], datePosted: 'past_week', minScoreToApply: 70, maxApplicationsPerSession: 10, excludedCompanies: [] };
    mockApiPost.mockResolvedValueOnce({ data: newPreset });

    renderConfigPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/presets');
    });

    const nameInput = screen.getByPlaceholderText('Name this preset...');
    fireEvent.change(nameInput, { target: { value: 'My Preset' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Preset/i }));

    await waitFor(() => {
      expect(screen.getByText('Preset saved.')).toBeInTheDocument();
    });
  });
});
