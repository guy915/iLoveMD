// Shared types for merge-markdown functionality

export interface MarkdownFile {
  id: string
  file: File
  content: string
}

export type SortMode = 'none' | 'alphabetical' | 'reverseAlphabetical'

export type SeparatorStyle = 'newline' | 'page-break'
