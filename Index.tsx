import { useState, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";

import CameraCapture, {
  FaceResult,
} from "@/components/CameraCapture";

import QuickRegister, {
  RegisterPayload,
} from "@/components/QuickRegister";

import { useFaceRecognition } from "@/hooks/useFaceRecognition";

import { distanceToSimilarityPercent } from "@/lib/faceDescriptorSimilarity";

type AppState = "camera" | "result" | "register";

export default function Index() {
  const {
    loading,
    loadError,
    modelsLoaded,
    dbReady,
    matchAllFaces,
    addPerson,
  } = useFaceRecognition();

  const [state, setState] =
    useState<AppState>("camera");

  const [scanning, setScanning] =
    useState(false);

  const [capturedImage, setCapturedImage] =
    useState<string | null>(null);

  const [faceResults, setFaceResults] =
    useState<FaceResult[]>([]);

  const handleMultiCapture = useCallback(
    async (imageDataUrl: string) => {
      setCapturedImage(imageDataUrl);
      setScanning(true);

      try {
        const img = new Image();

        img.src = imageDataUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(
              new Error(
                "Não foi possível carregar a imagem."
              )
            );
        });

        const results =
          await matchAllFaces(img);

        setFaceResults(results);

        /**
         * Se nenhum rosto foi detectado,
         * mostramos a tela de resultado.
         */
        if (results.length === 0) {
          setState("result");
        }
      } catch (error) {
        console.error(
          "Erro ao analisar a imagem:",
          error
        );

        setFaceResults([]);
        setState("result");
      } finally {
        setScanning(false);
      }
    },
    [matchAllFaces]
  );

  /**
   * Realiza o cadastro de uma nova pessoa.
   *
   * O cadastro contém somente:
   * - nome;
   * - foto principal;
   * - fotos adicionais.
   *
   * Nenhum outro dado pessoal é solicitado.
   */
  const handleRegister = useCallback(
    async (payload: RegisterPayload) => {
      if (!capturedImage) {
        return;
      }

      await addPerson(
        payload.name,
        capturedImage,
        payload.additionalPhotos
      );

      reset();
    },
    [addPerson, capturedImage]
  );

  /**
   * Volta para uma nova consulta.
   */
  const reset = () => {
    setState("camera");
    setCapturedImage(null);
    setFaceResults([]);
  };

  /**
   * Erro ao carregar os modelos.
   */
  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-heading text-destructive">
          Não foi possível carregar os modelos
          de IA.
        </p>

        <p className="max-w-md text-sm text-muted-foreground">
          {loadError}
        </p>

        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() =>
            window.location.reload()
          }
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  /**
   * Enquanto os modelos de IA estão sendo
   * carregados.
   */
  if (!modelsLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />

        <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Carregando modelos de reconhecimento...
        </p>
      </div>
    );
  }

  /**
   * Enquanto a base de rostos está sendo
   * preparada.
   */
  if (!dbReady || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />

        <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Preparando base de rostos cadastrados...
        </p>
      </div>
    );
  }

  const unknownFaces =
    faceResults.filter(
      (result) => result.person === null
    );

  const knownFaces =
    faceResults.filter(
      (result) => result.person !== null
    );

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">

      {/* Cabeçalho */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-lg mx-auto flex items-center gap-3 py-3 px-4">

          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
            <Shield className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h1 className="text-base leading-tight">
              PMSC — São José
            </h1>

            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Sistema de Reconhecimento Facial
            </p>
          </div>

        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto min-h-0 w-full min-w-0 max-w-lg flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">

        {/* Tela principal */}
        {state === "camera" && (
          <>
            <CameraCapture
              onCapture={() => {}}
              onMultiCapture={
                handleMultiCapture
              }
              scanning={scanning}
              faceResults={faceResults}
            />

            {/* Resultado do reconhecimento */}
            {faceResults.length > 0 && (
              <div className="space-y-3">

                {/* Pessoas reconhecidas */}
                {knownFaces.map(
                  (result, index) => (
                    <div
                      key={index}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-3"
                    >

                      <img
                        src={
                          result.person!.imageSrc
                        }
                        alt={
                          result.person!.name
                        }
                        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                      />

                      <div className="min-w-0 flex-1">

                        <p className="break-words text-sm font-heading text-foreground">
                          {result.person!.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Compatibilidade:{" "}
                          {distanceToSimilarityPercent(
                            result.distance
                          )}
                          %
                        </p>

                      </div>

                      <span className="text-xs font-heading text-success uppercase">
                        Identificado
                      </span>

                    </div>
                  )
                )}

                {/* Pessoas não reconhecidas */}
                {unknownFaces.map(
                  (_, index) => (
                    <div
                      key={`unknown-${index}`}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                    >

                      <div className="min-w-0">

                        <p className="text-sm font-heading text-foreground">
                          Rosto não reconhecido
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Não foi encontrada uma correspondência no banco.
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setState(
                            "register"
                          );
                        }}
                        className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground font-heading font-semibold uppercase tracking-wider text-xs hover:brightness-110 transition"
                      >
                        Novo cadastro
                      </button>

                    </div>
                  )
                )}

                {/* Nova consulta */}
                <button
                  type="button"
                  onClick={reset}
                  className="w-full px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-heading font-semibold uppercase tracking-wider text-xs hover:brightness-110 transition"
                >
                  Nova Consulta
                </button>

              </div>
            )}
          </>
        )}

        {/* Resultado quando nenhum rosto foi detectado */}
        {state === "result" && (
          <div className="text-center space-y-4">

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-heading text-foreground">
                Nenhum rosto detectado
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Não foi possível encontrar um rosto
                na imagem capturada.
              </p>
            </div>

            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-heading font-semibold uppercase tracking-wider text-xs hover:brightness-110 transition"
            >
              Nova Consulta
            </button>

          </div>
        )}

        {/* Cadastro */}
        {state === "register" &&
          capturedImage && (
            <QuickRegister
              capturedImage={
                capturedImage
              }
              onRegister={
                handleRegister
              }
              onCancel={() =>
                setState("camera")
              }
            />
          )}

      </main>

      {/* Rodapé */}
      <footer className="border-t border-border py-2">
        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest">
          Sistema de Reconhecimento Facial
        </p>
      </footer>

    </div>
  );
}