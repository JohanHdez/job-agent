/**
 * Types related to CV parsing and professional profile extraction.
 */

export interface ProfessionalProfile {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  headline: string;
  summary: string;
  seniority: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Executive';
  yearsOfExperience: number;
  skills: string[];
  techStack: string[];
  languages: Language[];
  experience: WorkExperience[];
  education: Education[];
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | 'Present';
  description: string[];
  technologies: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationYear: number;
}

export interface Language {
  name: string;
  level: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic';
}

/** Raw text extracted from the CV before parsing */
export interface RawCvData {
  filePath: string;
  text: string;
  pageCount: number;
  extractedAt: string;
}
