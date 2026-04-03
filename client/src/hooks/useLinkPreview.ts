import { useState, useEffect } from "react";

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export function useLinkPreview(url: string | null) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      return;
    }
    setLoading(true);
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success") {
          setPreview({
            url,
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url,
            siteName: data.data.publisher,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);

  return { preview, loading };
}
