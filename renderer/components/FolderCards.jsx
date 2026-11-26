import { Folder } from 'lucide-react'

export default function FolderCards({ folders, countsByFolder, onOpen }) {
  return (
    <div className="folder-cards">
      {folders.map((folder) => (
        <button key={folder.id} className="folder-card" onClick={() => onOpen(folder)}>
          <span className="folder-card-icon">
            <Folder size={18} />
          </span>
          <span className="folder-card-copy">
            <strong>{folder.name}</strong>
            <span>{countsByFolder.get(folder.id) || 0} 个素材</span>
          </span>
        </button>
      ))}
    </div>
  )
}
