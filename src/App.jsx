import JSZip from "jszip";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import "./App.css";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

async function compressImageUnder8MB(file) {
  if (file.size <= MAX_IMAGE_SIZE) {
    return file;
  }

  const image = await loadImageFromFile(file);

  let width = image.width;
  let height = image.height;
  let quality = 0.85;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  let compressedBlob = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    compressedBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (compressedBlob && compressedBlob.size <= MAX_IMAGE_SIZE) {
      break;
    }

    quality -= 0.08;

    if (quality < 0.45) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      quality = 0.8;
    }
  }

  URL.revokeObjectURL(image.src);

  if (!compressedBlob || compressedBlob.size > MAX_IMAGE_SIZE) {
    throw new Error(`${file.name} could not be compressed under 8 MB`);
  }

  const cleanName = file.name.replace(/\.[^/.]+$/, "");

  return new File([compressedBlob], `${cleanName}.jpg`, {
    type: "image/jpeg",
  });
}

function App() {
  const [processingSelected, setProcessingSelected] = useState(false);
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);

  async function getAuthHeaders() {
    if (!user) return {};
    const token = await user.getIdToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async function loadPhotos(currentUser = user) {
    if (!currentUser) {
      setPhotos([]);
      setLoading(false);
      return;
    }
  
    setLoading(true);
  
    const token = await currentUser.getIdToken(true);
    const headers = {
      Authorization: `Bearer ${token}`,
    };
  
    const response = await fetch("/api/photos", { headers });
  
    if (!response.ok) {
      setPhotos([]);
      setLoading(false);
      return;
    }
  
    const savedPhotos = await response.json();
  
    if (!Array.isArray(savedPhotos)) {
      setPhotos([]);
      setLoading(false);
      return;
    }
  
    const photosWithImages = await Promise.all(
      savedPhotos.map(async (photo) => {
        const imageResponse = await fetch(photo.imageUrl, { headers });
      
        if (!imageResponse.ok) {
          return {
            ...photo,
            displayUrl: "",
          };
        }
      
        const imageBlob = await imageResponse.blob();
      
        return {
          ...photo,
          displayUrl: URL.createObjectURL(imageBlob),
        };
      })
    );
  
    setPhotos(photosWithImages);
    setLoading(false);
  }

  async function handleSignIn() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSignOut() {
    await signOut(auth);
    setPhotos([]);
  }

  async function addPhotos(event) {
    const selectedFiles = Array.from(event.target.files);

    if (!user || selectedFiles.length === 0) {
      return;
    }

    setUploading(true);

    try {
      const headers = await getAuthHeaders();

      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const finalFile = await compressImageUnder8MB(file);

        const formData = new FormData();
        formData.append("photo", finalFile);

        const response = await fetch("/api/photos", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
        }
      }

      await loadPhotos();
    } catch (error) {
      alert(error.message || "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  function togglePhotoSelection(id) {
    setSelectedPhotoIds((current) =>
      current.includes(id)
        ? current.filter((photoId) => photoId !== id)
        : [...current, id]
    );
  
    setOpenMenuId(null);
  }
  
  function downloadPhoto(photo) {
    if (!photo.displayUrl) {
      alert("This image is unavailable.");
      return;
    }
  
    const link = document.createElement("a");
    link.href = photo.displayUrl;
    link.download = photo.filename || "photo";
    document.body.appendChild(link);
    link.click();
    link.remove();
  
    setOpenMenuId(null);
  }
  async function deleteAllSelected() {
    if (selectedPhotoIds.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete ${selectedPhotoIds.length} selected photos?`
    );

    if (!confirmed) return;

    setProcessingSelected(true);

    try {
      const headers = await getAuthHeaders();

      const responses = await Promise.all(
        selectedPhotoIds.map((id) =>
          fetch(`/api/photos/${id}`, {
            method: "DELETE",
            headers,
          })
        )
      );

      if (responses.some((response) => !response.ok)) {
        throw new Error("Some photos could not be deleted.");
      }

      setSelectedPhotoIds([]);
      setOpenMenuId(null);
      await loadPhotos();
    } catch (error) {
      alert(error.message);
    } finally {
      setProcessingSelected(false);
    }
  }

  async function downloadAllSelected() {
    const selectedPhotos = photos.filter((photo) =>
      selectedPhotoIds.includes(photo.id)
    );

    if (selectedPhotos.length === 0) return;

    setProcessingSelected(true);

    try {
      const zip = new JSZip();

      for (let index = 0; index < selectedPhotos.length; index++) {
        const photo = selectedPhotos[index];

        if (!photo.displayUrl) continue;

        const response = await fetch(photo.displayUrl);
        const blob = await response.blob();
        const filename = `${index + 1}-${photo.filename || "photo.jpg"}`;

        zip.file(filename, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "selected-photos.zip";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("The selected photos could not be downloaded.");
    } finally {
      setProcessingSelected(false);
    }
  }
  async function deletePhoto(id) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this photo?"
    );

    if (!confirmed) return;

    const headers = await getAuthHeaders();

    const response = await fetch(`/api/photos/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      alert("The photo could not be deleted.");
      return;
    }

    setSelectedPhotoIds((current) =>
      current.filter((photoId) => photoId !== id)
    );
    setOpenMenuId(null);

    await loadPhotos();
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      loadPhotos(currentUser);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="app">Loading...</div>;
  }

  return (
    <div className="app">
    <nav className="navbar">
      <a className="brand" href="#home">Photo Gallery</a>

      <div className="navLinks">
        <a href="#home">Home</a>
        <Link to="/about">About</Link>
        <Link to="/albums">Album</Link>
        <a href="#gallery">Gallery</a>
      </div>
    </nav>
      <header id="home" className="topBar">
        <div>
          <h1>My Photo Board</h1>
          <p>Your private Pinterest-style gallery.</p>
        </div>

        <div className="actions">
          {user ? (
            <>
              <span className="userEmail">{user.email}</span>

              <label className="uploadButton">
                {uploading ? "Uploading..." : "Add Photos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  onChange={addPhotos}
                />
              </label>

              <button className="secondaryButton" onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <button className="uploadButton" onClick={handleSignIn}>
              Sign In With Google
            </button>
          )}
        </div>
      </header>

      {user && selectedPhotoIds.length > 0 && (
        <div className="selectedActions">
          <span>{selectedPhotoIds.length} selected</span>
      
          <button
            className="downloadAllButton"
            disabled={processingSelected}
            onClick={downloadAllSelected}
          >
            Download All
          </button>
      
          <button
            className="deleteAllButton"
            disabled={processingSelected}
            onClick={deleteAllSelected}
          >
            {processingSelected ? "Working..." : "Delete All"}
          </button>
        </div>
      )}

      {!user ? (
        <section className="emptyState">
          <h2>Sign in to see your photos</h2>
          <p>Your photos will be saved privately to your account.</p>
        </section>
      ) : photos.length === 0 ? (
        <section className="emptyState">
          <h2>No photos yet</h2>
          <p>Add photos and they will stay saved after refresh.</p>
        </section>
      ) : (
        <section id="gallery" className="gallery">
          {photos.map((photo) => (
            <div
              className={`photoCard ${
                selectedPhotoIds.includes(photo.id) ? "selected" : ""
              }`}
              key={photo.id}
            >
              {photo.displayUrl ? (
                <img src={photo.displayUrl} alt={photo.filename} />
              ) : (
                <div className="imageError">Image could not load</div>
              )}
            
              {selectedPhotoIds.includes(photo.id) && (
                <span className="selectedBadge">Selected</span>
              )}
            
              <div className="photoMenuContainer">
                <button
                  className="menuButton"
                  aria-label="Photo options"
                  onClick={() =>
                    setOpenMenuId((current) =>
                      current === photo.id ? null : photo.id
                    )
                  }
                >
                  {"\u22EE"}
                </button>
                
                {openMenuId === photo.id && (
                  <div className="photoMenu">
                    <button onClick={() => togglePhotoSelection(photo.id)}>
                      {selectedPhotoIds.includes(photo.id)
                        ? "Deselect"
                        : "Select"}
                    </button>
                      
                    <button onClick={() => downloadPhoto(photo)}>
                      Download
                    </button>
                      
                    <button
                      className="deleteMenuOption"
                      onClick={() => deletePhoto(photo.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
      

      <footer className="siteFooter">
        <span>Photo Gallery</span>
        <Link to="/about">About</Link>
      </footer>
    </div>
  );
}

export default App;

