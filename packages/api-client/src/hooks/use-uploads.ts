import { useMutation } from "@tanstack/react-query"

/**
 * What the image is for. Picks the endpoint, which in turn picks the required
 * permission (settings.manage vs foods.manage) and the storage prefix.
 */
export type UploadPurpose = "branding" | "food"

/**
 * Uploads an image and returns its hosted URL, for writing into a logoUrl /
 * faviconUrl / imageUrl field.
 *
 * Deliberately does not go through apiClient: that helper forces
 * Content-Type: application/json, whereas FormData needs the browser to set
 * the header itself so the generated multipart boundary is included.
 */
export function useUploadImage(purpose: UploadPurpose) {
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string }> => {
      const form = new FormData()
      form.append("file", file)

      const response = await fetch(`/api/backend/uploads/${purpose}`, {
        method: "POST",
        body: form,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message ?? `Upload failed with ${response.status}`)
      }

      return (await response.json()) as { url: string }
    },
  })
}
