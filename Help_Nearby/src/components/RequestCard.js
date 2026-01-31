export default function RequestCard({ request, onClick }) {
  return (
    <div
      className="card shadow-sm mb-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="card-body">
        <span className="badge bg-primary mb-2">
          {request.category}
        </span>
        <p className="mb-2">{request.description}</p>
        <small className="text-muted">
          Requested by {request.user?.name}
        </small>
      </div>
    </div>
  );
}
