import { HistoryIcon, TrashIcon } from '../icons';

interface Session {
  id: number;
  userId: string;
  startTime: string;
  endTime?: string;
  status: string;
  aiModel: string;
  analysisMode: string;
}

interface SessionsSidebarProps {
  sessions?: Session[];
  onSessionSelect?: (sessionId: number) => void;
  onSessionDelete?: (sessionId: number) => void;
}

export function SessionsSidebar({
  sessions = [],
  onSessionSelect,
  onSessionDelete
}: SessionsSidebarProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US');
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700';
      case 'FAILED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'Completed';
      case 'PROCESSING':
        return 'Processing';
      case 'FAILED':
        return 'Failed';
      default:
        return status;
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <HistoryIcon className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-sm text-gray-500">No sessions yet</p>
        <p className="text-xs text-gray-400 mt-2">
          Start recording to see sessions here
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer group"
          onClick={() => onSessionSelect?.(session.id)}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">
                Session #{session.id}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {formatDate(session.startTime)}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSessionDelete?.(session.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                session.status
              )}`}
            >
              {getStatusText(session.status)}
            </span>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-600 space-y-1">
            <div>Model: {session.aiModel}</div>
            <div>Mode: {session.analysisMode}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
