
import { useState, useRef, useCallback, useEffect } from "react";
import * as faceapi from "face-api.js";

import {
  Person,
  initialPersons,
  getPersonPhotoSources,
} from "@/data/persons";

import {
  FACE_MATCH_DISTANCE_THRESHOLD,
  distanceToSimilarityPercent,
  logFaceMatchDebug,
} from "@/lib/faceDescriptorSimilarity";

interface LabeledPerson {
  person: Person;
  descriptor: Float32Array;
}

/**
 * Modelos oficiais do face-api.js.
 */
const REMOTE_MODEL_BASE =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

/**
 * Limite mais restritivo para evitar falsos positivos.
 *
 * Quanto MENOR a distância, mais parecido é o rosto.
 */
const FACE_RECOGNITION_THRESHOLD = 0.5;

/**
 * Diferença mínima entre o melhor resultado
 * e o segundo melhor resultado.
 *
 * Isso evita reconhecer uma pessoa quando
 * dois cadastros são igualmente parecidos.
 */
const MINIMUM_MATCH_MARGIN = 0.05;

/**
 * Obtém o descriptor facial de uma imagem.
 */
async function descriptorFromImage(
  imageSrc: string
): Promise<Float32Array | null> {
  const img = await faceapi.fetchImage(imageSrc);

  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

/**
 * Cria descriptors para todas as imagens
 * de uma pessoa.
 */
async function addPersonDescriptors(
  person: Person,
  labeled: LabeledPerson[]
) {
  for (const photoSrc of getPersonPhotoSources(person)) {
    try {
      const descriptor =
        await descriptorFromImage(photoSrc);

      if (descriptor) {
        labeled.push({
          person,
          descriptor,
        });
      }
    } catch (error) {
      console.warn(
        `Não foi possível processar a foto de ${person.name}:`,
        error
      );
    }
  }
}

/**
 * Carrega os modelos necessários.
 */
async function loadFaceModels(
  modelBaseUri: string
) {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(
      modelBaseUri
    ),
    faceapi.nets.faceLandmark68Net.loadFromUri(
      modelBaseUri
    ),
    faceapi.nets.faceRecognitionNet.loadFromUri(
      modelBaseUri
    ),
  ]);
}

export function useFaceRecognition() {
  const [modelsLoaded, setModelsLoaded] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [persons, setPersons] =
    useState<Person[]>(initialPersons);

  const labeledRef =
    useRef<LabeledPerson[]>([]);

  const [dbReady, setDbReady] =
    useState(false);

  /**
   * Carrega os modelos.
   */
  useEffect(() => {
    const load = async () => {
      const base =
        import.meta.env.BASE_URL.endsWith("/")
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;

      const localModels =
        `${base}models`;

      try {
        await loadFaceModels(
          localModels
        );
      } catch (error) {
        console.warn(
          "Modelos locais indisponíveis. Tentando modelos oficiais:",
          error
        );

        await loadFaceModels(
          REMOTE_MODEL_BASE
        );
      }

      setModelsLoaded(true);
      setLoading(false);
    };

    load().catch((error) => {
      console.error(
        "Falha ao carregar os modelos:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setLoadError(message);
      setLoading(false);
    });
  }, []);

  /**
   * Monta a base de reconhecimento.
   */
  const buildDatabase =
    useCallback(async () => {
      if (!modelsLoaded) {
        return;
      }

      setLoading(true);

      const labeled: LabeledPerson[] =
        [];

      try {
        for (const person of persons) {
          await addPersonDescriptors(
            person,
            labeled
          );
        }

        labeledRef.current =
          labeled;
      } finally {
        setDbReady(true);
        setLoading(false);
      }
    }, [modelsLoaded, persons]);

  /**
   * Reconstrói a base quando a lista
   * de pessoas muda.
   */
  useEffect(() => {
    if (modelsLoaded) {
      void buildDatabase();
    }
  }, [
    modelsLoaded,
    buildDatabase,
  ]);

  /**
   * Reconhece um único rosto.
   */
  const matchFace =
    useCallback(
      async (
        imageElement:
          | HTMLImageElement
          | HTMLCanvasElement
          | HTMLVideoElement
      ): Promise<{
        person: Person;
        distance: number;
      } | null> => {
        if (
          !dbReady ||
          labeledRef.current.length === 0
        ) {
          return null;
        }

        const detection =
          await faceapi
            .detectSingleFace(
              imageElement
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
          return null;
        }

        const matches =
          labeledRef.current
            .map((entry) => ({
              person:
                entry.person,
              distance:
                faceapi.euclideanDistance(
                  detection.descriptor,
                  entry.descriptor
                ),
            }))
            .sort(
              (a, b) =>
                a.distance -
                b.distance
            );

        if (
          matches.length === 0
        ) {
          return null;
        }

        const bestMatch =
          matches[0];

        const secondBest =
          matches[1];

        /**
         * Verifica se a distância é suficientemente baixa.
         */
        const distanceIsGood =
          bestMatch.distance <
          FACE_RECOGNITION_THRESHOLD;

        /**
         * Se existir uma segunda pessoa,
         * exige uma diferença mínima entre
         * o primeiro e o segundo resultado.
         */
        const marginIsGood =
          !secondBest ||
          (
            secondBest.distance -
              bestMatch.distance >=
            MINIMUM_MATCH_MARGIN
          );

        if (
          distanceIsGood &&
          marginIsGood
        ) {
          const similarity =
            distanceToSimilarityPercent(
              bestMatch.distance
            );

          logFaceMatchDebug(
            "matchFace",
            bestMatch.distance,
            similarity
          );

          return {
            person:
              bestMatch.person,
            distance:
              bestMatch.distance,
          };
        }

        /**
         * O rosto não é suficientemente
         * parecido com um cadastro.
         */
        return null;
      },
      [dbReady]
    );

  /**
   * Reconhece todos os rostos.
   */
  const matchAllFaces =
    useCallback(
      async (
        imageElement:
          | HTMLImageElement
          | HTMLCanvasElement
          | HTMLVideoElement
      ): Promise<
        Array<{
          person:
            | Person
            | null;
          distance:
            | number
            | null;
          box: {
            x: number;
            y: number;
            width: number;
            height: number;
          };
        }>
      > => {
        if (!dbReady) {
          return [];
        }

        const detections =
          await faceapi
            .detectAllFaces(
              imageElement
            )
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (
          !detections ||
          detections.length === 0
        ) {
          return [];
        }

        return detections.map(
          (det, index) => {
            const {
              x,
              y,
              width,
              height,
            } =
              det.detection.box;

            /**
             * Calcula a distância
             * desse rosto para TODOS
             * os cadastros.
             */
            const matches =
              labeledRef.current
                .map((entry) => ({
                  person:
                    entry.person,
                  distance:
                    faceapi.euclideanDistance(
                      det.descriptor,
                      entry.descriptor
                    ),
                }))
                .sort(
                  (a, b) =>
                    a.distance -
                    b.distance
                );

            /**
             * Nenhum cadastro disponível.
             */
            if (
              matches.length === 0
            ) {
              return {
                person: null,
                distance: null,
                box: {
                  x,
                  y,
                  width,
                  height,
                },
              };
            }

            const bestMatch =
              matches[0];

            const secondBest =
              matches[1];

            /**
             * Primeiro critério:
             * o melhor resultado precisa
             * estar realmente próximo.
             */
            const distanceIsGood =
              bestMatch.distance <
              FACE_RECOGNITION_THRESHOLD;

            /**
             * Segundo critério:
             * o melhor resultado precisa
             * ser claramente melhor que
             * o segundo.
             */
            const marginIsGood =
              !secondBest ||
              (
                secondBest.distance -
                  bestMatch.distance >=
                MINIMUM_MATCH_MARGIN
              );

            /**
             * Só reconhece quando os dois
             * critérios são satisfeitos.
             */
            if (
              distanceIsGood &&
              marginIsGood
            ) {
              const similarity =
                distanceToSimilarityPercent(
                  bestMatch.distance
                );

              logFaceMatchDebug(
                `matchAllFaces#${index} → ${bestMatch.person.name}`,
                bestMatch.distance,
                similarity
              );

              return {
                person:
                  bestMatch.person,
                distance:
                  bestMatch.distance,
                box: {
                  x,
                  y,
                  width,
                  height,
                },
              };
            }

            /**
             * Rosto detectado, mas não
             * existe correspondência segura.
             */
            return {
              person: null,
              distance: null,
              box: {
                x,
                y,
                width,
                height,
              },
            };
          }
        );
      },
      [dbReady]
    );

  /**
   * Cadastra uma nova pessoa.
   */
  const addPerson =
    useCallback(
      async (
        name: string,
        imageSrc: string,
        additionalPhotos: string[] = []
      ) => {
        const newPerson: Person = {
          id:
            crypto.randomUUID(),
          name:
            name.trim(),
          imageSrc,
          additionalPhotos,
          registeredAt:
            new Date()
              .toISOString()
              .split("T")[0],
        };

        /**
         * Adiciona à lista.
         */
        setPersons(
          (prev) => [
            ...prev,
            newPerson,
          ]
        );

        /**
         * Adiciona imediatamente
         * os descriptors à base atual.
         */
        await addPersonDescriptors(
          newPerson,
          labeledRef.current
        );

        return newPerson;
      },
      []
    );

  return {
    modelsLoaded,
    loading,
    loadError,
    dbReady,
    persons,
    matchFace,
    matchAllFaces,
    addPerson,
  };
}