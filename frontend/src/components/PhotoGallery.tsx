// Stub component for photo gallery
import type { PersonPhotoOut } from "../api/types";

interface Props {
  photos: PersonPhotoOut[];
  personId: number;
  onPhotosChange?: () => void;
}

export default function PhotoGallery({ photos }: Props) {
  if (photos.length === 0) {
    return (
      <div className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
        No photos
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="aspect-square rounded border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          {photo.url && (
            <img
              src={photo.url}
              alt={photo.caption || "Photo"}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
