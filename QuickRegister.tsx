```tsx
import { useRef, useState } from "react";
import { UserPlus, ArrowLeft, Upload, X } from "lucide-react";

export interface RegisterPayload {
  name: string;
  additionalPhotos: string[];
}

interface QuickRegisterProps {
  capturedImage: string;
  onRegister: (payload: RegisterPayload) => void;
  onCancel: () => void;
}

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isAllowedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase();

  if (ACCEPTED_MIME_TYPES.has(mime)) {
    return true;
  }

  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Formato inválido"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Não foi possível ler o arquivo"));
    };

    reader.readAsDataURL(file);
  });
}

export default function QuickRegister({
  capturedImage,
  onRegister,
  onCancel,
}: QuickRegisterProps) {
  const [name, setName] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    // A imagem principal já vem da câmera através de capturedImage.
    // As imagens escolhidas pelo usuário são adicionadas em additionalPhotos.
    onRegister({
      name: trimmedName,
      additionalPhotos: [...additionalPhotos],
    });
  };

  const handleAdditionalPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;

    // Permite selecionar novamente o mesmo arquivo.
    e.target.value = "";

    setUploadError("");

    if (!files || files.length === 0) {
      return;
    }

    const fileList = Array.from(files);

    const invalidFiles = fileList.filter(
      (file) => !isAllowedImageFile(file)
    );

    if (invalidFiles.length > 0) {
      setUploadError(
        "Alguns arquivos foram ignorados. Use apenas JPG, JPEG, PNG ou WEBP."
      );
    }

    const validFiles = fileList.filter(isAllowedImageFile);

    if (validFiles.length === 0) {
      return;
    }

    try {
      const dataUrls = await Promise.all(
        validFiles.map((file) => readFileAsDataUrl(file))
      );

      setAdditionalPhotos((prev) => {
        return [...prev, ...dataUrls];
      });
    } catch (error) {
      console.error("Erro ao carregar imagem:", error);

      setUploadError(
        "Não foi possível carregar uma ou mais imagens."
      );
    }
  };

  const removePhoto = (index: number) => {
    setAdditionalPhotos((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-lg border-2 border-accent/50 bg-card p-6 glow-accent">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-4">
          <UserPlus className="w-7 h-7 text-accent" />

          <h2 className="text-xl font-heading text-foreground">
            Cadastro de Pessoa
          </h2>
        </div>

        {/* Foto principal */}
        <div className="mb-4">
          <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-2 text-center">
            Foto principal
          </p>

          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Foto principal do rosto"
              className="w-28 h-28 rounded-lg object-cover border border-border mx-auto"
            />
          ) : (
            <div className="w-28 h-28 rounded-lg border border-destructive mx-auto flex items-center justify-center text-xs text-destructive text-center">
              Nenhuma imagem
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nome */}
          <div>
            <label
              htmlFor="person-name"
              className="block text-xs font-heading uppercase tracking-wider text-muted-foreground mb-1"
            >
              Nome completo *
            </label>

            <input
              id="person-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-3 py-2 rounded-md bg-muted text-foreground border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="Digite o nome..."
              autoFocus
            />
          </div>

          {/* Fotos adicionais */}
          <div>
            <label
              htmlFor="additional-photos"
              className="block text-xs font-heading uppercase tracking-wider text-muted-foreground mb-1"
            >
              Imagens adicionais
            </label>

            <p className="text-[11px] text-muted-foreground mb-2">
              Adicione outras imagens do rosto para melhorar o reconhecimento.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-xs font-heading uppercase tracking-wider text-muted-foreground transition hover:border-accent/50 hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              Adicionar imagens
            </button>

            <input
              ref={fileInputRef}
              id="additional-photos"
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleAdditionalPhotos}
              aria-label="Adicionar imagens adicionais"
            />

            {/* Erro */}
            {uploadError && (
              <p
                className="mt-2 text-xs text-destructive"
                role="alert"
              >
                {uploadError}
              </p>
            )}

            {/* Quantidade de imagens */}
            {additionalPhotos.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {additionalPhotos.length} imagem(ns) adicional(is) selecionada(s).
              </p>
            )}

            {/* Pré-visualização */}
            {additionalPhotos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {additionalPhotos.map((photo, index) => (
                  <div
                    key={`${photo.slice(0, 20)}-${index}`}
                    className="relative"
                  >
                    <img
                      src={photo}
                      alt={`Imagem adicional ${index + 1}`}
                      className="h-16 w-16 rounded-md border border-border object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      aria-label={`Remover imagem adicional ${index + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-heading font-semibold uppercase tracking-wider text-xs hover:brightness-110 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>

            <button
              type="submit"
              disabled={!name.trim() || !capturedImage}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-heading font-semibold uppercase tracking-wider text-xs hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
