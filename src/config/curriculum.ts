/**
 * Curriculum Topics
 *
 * Topics aligned with TIMSS, PISA, and common international curricula.
 * TIMSS domains: Mathematics (Number, Algebra, Geometry & Measurement, Data & Probability);
 * Science (Biology, Chemistry, Physics, Earth Science). Grade bands retained for internal use.
 */

export type GradeBand = '5-6' | '7-8' | '9-11';

export interface CurriculumTopic {
  id: string;
  name: string;
  gradeBands: GradeBand[];
}

import { SUBJECTS } from './constants';
export type SubjectId = (typeof SUBJECTS)[number]['id'];

/** Topics per subject, ordered by typical progression. Matches majority of student curricula. */
export const CURRICULUM_TOPICS: Record<SubjectId, CurriculumTopic[]> = {
  mathematics: [
    { id: 'number', name: 'Number', gradeBands: ['5-6', '7-8'] },
    { id: 'algebra', name: 'Algebra', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'geometry', name: 'Geometry', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'measurement', name: 'Measurement', gradeBands: ['5-6', '7-8'] },
    { id: 'data-probability', name: 'Data and Probability', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'fractions-decimals', name: 'Fractions and Decimals', gradeBands: ['5-6'] },
    { id: 'ratios-percentages', name: 'Ratios and Percentages', gradeBands: ['5-6', '7-8'] },
    { id: 'linear-equations', name: 'Linear Equations', gradeBands: ['7-8', '9-11'] },
    { id: 'quadratics', name: 'Quadratic Equations', gradeBands: ['9-11'] },
    { id: 'trigonometry', name: 'Trigonometry', gradeBands: ['9-11'] },
  ],
  physics: [
    { id: 'motion-forces', name: 'Motion and Forces', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'energy', name: 'Energy', gradeBands: ['7-8', '9-11'] },
    { id: 'waves-sound', name: 'Waves and Sound', gradeBands: ['7-8', '9-11'] },
    { id: 'light-optics', name: 'Light and Optics', gradeBands: ['7-8', '9-11'] },
    { id: 'electricity-magnetism', name: 'Electricity and Magnetism', gradeBands: ['7-8', '9-11'] },
    { id: 'matter-heat', name: 'Matter and Heat', gradeBands: ['5-6', '7-8'] },
  ],
  chemistry: [
    { id: 'matter-properties', name: 'Matter and Its Properties', gradeBands: ['5-6', '7-8'] },
    { id: 'atoms-periodic', name: 'Atoms and the Periodic Table', gradeBands: ['7-8', '9-11'] },
    { id: 'chemical-reactions', name: 'Chemical Reactions', gradeBands: ['7-8', '9-11'] },
    { id: 'acids-bases', name: 'Acids, Bases, and Salts', gradeBands: ['7-8', '9-11'] },
    { id: 'organic-chemistry', name: 'Organic Chemistry', gradeBands: ['9-11'] },
  ],
  biology: [
    { id: 'cells', name: 'Cells and Organisms', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'plants-animals', name: 'Plant and Animal Biology', gradeBands: ['5-6', '7-8'] },
    { id: 'human-body', name: 'Human Body Systems', gradeBands: ['7-8', '9-11'] },
    { id: 'genetics', name: 'Genetics and Heredity', gradeBands: ['9-11'] },
    { id: 'ecology', name: 'Ecology and Ecosystems', gradeBands: ['7-8', '9-11'] },
  ],
  'azerbaijani-language': [
    { id: 'grammar', name: 'Grammar', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'reading', name: 'Reading Comprehension', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'writing', name: 'Writing and Composition', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'vocabulary', name: 'Vocabulary', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'punctuation', name: 'Punctuation and Spelling', gradeBands: ['5-6', '7-8'] },
  ],
  'azerbaijani-literature': [
    { id: 'literary-genres', name: 'Literary Genres', gradeBands: ['5-6', '7-8'] },
    { id: 'poetry', name: 'Poetry', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'prose', name: 'Prose and Fiction', gradeBands: ['7-8', '9-11'] },
    { id: 'classic-works', name: 'Classic Works', gradeBands: ['9-11'] },
    { id: 'literary-analysis', name: 'Literary Analysis', gradeBands: ['9-11'] },
  ],
  english: [
    { id: 'grammar', name: 'Grammar', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'reading', name: 'Reading Comprehension', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'writing', name: 'Writing', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'vocabulary', name: 'Vocabulary', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'listening-speaking', name: 'Listening and Speaking', gradeBands: ['5-6', '7-8'] },
  ],
  russian: [
    { id: 'grammar', name: 'Grammar', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'reading', name: 'Reading Comprehension', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'writing', name: 'Writing', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'vocabulary', name: 'Vocabulary', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'conversation', name: 'Conversation', gradeBands: ['7-8', '9-11'] },
  ],
  history: [
    { id: 'ancient', name: 'Ancient History', gradeBands: ['5-6', '7-8'] },
    { id: 'medieval', name: 'Medieval History', gradeBands: ['7-8'] },
    { id: 'modern', name: 'Modern History', gradeBands: ['7-8', '9-11'] },
    { id: 'world-history', name: 'World History', gradeBands: ['9-11'] },
    { id: 'regional-history', name: 'Regional History', gradeBands: ['7-8', '9-11'] },
  ],
  geography: [
    { id: 'physical-geography', name: 'Physical Geography', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'human-geography', name: 'Human Geography', gradeBands: ['7-8', '9-11'] },
    { id: 'maps-skills', name: 'Maps and Map Skills', gradeBands: ['5-6', '7-8'] },
    { id: 'climate', name: 'Climate and Weather', gradeBands: ['7-8', '9-11'] },
    { id: 'resources', name: 'Natural Resources', gradeBands: ['7-8', '9-11'] },
  ],
  'information-technology': [
    { id: 'computer-basics', name: 'Computer Basics', gradeBands: ['5-6', '7-8'] },
    { id: 'digital-literacy', name: 'Digital Literacy', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'internet-safety', name: 'Internet Safety', gradeBands: ['5-6', '7-8'] },
    { id: 'programming', name: 'Programming Basics', gradeBands: ['7-8', '9-11'] },
    { id: 'data-handling', name: 'Data and Information', gradeBands: ['7-8', '9-11'] },
  ],
  civics: [
    { id: 'government', name: 'Government and Democracy', gradeBands: ['7-8', '9-11'] },
    { id: 'rights-responsibilities', name: 'Rights and Responsibilities', gradeBands: ['5-6', '7-8', '9-11'] },
    { id: 'citizenship', name: 'Citizenship', gradeBands: ['7-8', '9-11'] },
    { id: 'law', name: 'Law and Justice', gradeBands: ['9-11'] },
  ],
};
