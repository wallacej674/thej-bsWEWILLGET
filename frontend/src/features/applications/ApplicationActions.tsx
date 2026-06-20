import { Eye, Pencil, Trash2 } from "lucide-react";

interface ApplicationActionsProps {
  applicationOwnerId: string;
  canModerate: boolean;
  currentUserId: string;
  onDelete: () => void;
  onEdit: () => void;
  onView: () => void;
}

export function ApplicationActions({
  applicationOwnerId,
  canModerate,
  currentUserId,
  onDelete,
  onEdit,
  onView,
}: ApplicationActionsProps) {
  const owned = applicationOwnerId === currentUserId;
  const buttonClass =
    "rounded p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <div className="flex items-center justify-end gap-1">
      <button className={buttonClass} onClick={onView} aria-label="View application">
        <Eye size={14} />
      </button>
      {owned && (
        <button
          className={buttonClass}
          onClick={onEdit}
          aria-label="Edit application"
        >
          <Pencil size={14} />
        </button>
      )}
      {(owned || canModerate) && (
        <button
          className={`${buttonClass} hover:text-red-400`}
          onClick={onDelete}
          aria-label="Delete application"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
