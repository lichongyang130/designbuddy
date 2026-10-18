import type { ProjectFile } from "./models/project";

export interface FileExplorerProps {
  files: ProjectFile[];
  selectedPath?: string;
  onSelect(path: string): void;
}

const fileMark: Record<ProjectFile["language"], string> = { html: "H", css: "#", javascript: "JS", json: "{}", text: "TXT" };

export function FileExplorer({ files, selectedPath, onSelect }: FileExplorerProps) {
  if (files.length === 0) return <p className="workspace-file-empty">项目中还没有文件。</p>;
  return (
    <nav className="workspace-file-list" aria-label="项目文件">
      {files.map((file) => (
        <button key={file.path} type="button" aria-current={selectedPath === file.path ? "page" : undefined} className={`db-file-item${selectedPath === file.path ? " is-active" : ""}`} onClick={() => onSelect(file.path)}>
          <span className={`db-file-badge db-file-${file.language}`} aria-hidden="true">{fileMark[file.language]}</span><span>{file.path}</span>
        </button>
      ))}
    </nav>
  );
}
