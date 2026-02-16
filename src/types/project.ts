/**
 * Represents a file to be created in the project
 */
export interface ProjectFile {
    /** Relative path to the file from workspace root */
    path: string;
    /** Content of the file */
    content: string;
    /** File status (new or modified) */
    status?: 'new' | 'modified' | 'unchanged';
}

/**
 * Represents the complete project structure returned by AI
 */
export interface ProjectStructure {
    /** List of folders to create (relative paths) */
    folders: string[];
    /** List of files to create with their content */
    files: ProjectFile[];
    /** Optional project name */
    projectName?: string;
    /** Optional description of what was generated */
    description?: string;
}

/**
 * AI response wrapper
 */
export interface AIResponse {
    success: boolean;
    data?: ProjectStructure;
    error?: string;
    rawResponse?: string;
}
