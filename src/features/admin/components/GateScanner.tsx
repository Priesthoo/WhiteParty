
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  BrowserQRCodeReader,
} from "@zxing/browser";

import {
  Camera,
  CameraOff,
  ScanLine,
  Keyboard,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
} from "@/components/ui";

// ===========================================================
// TYPES
// ===========================================================

type ScannerControls = Awaited<
  ReturnType<BrowserQRCodeReader["decodeFromVideoDevice"]>
>;

type VerificationMethod = "qr" | "manual";

type GateResult = {
  status: string;
  message: string;
  ticketCode?: string;
  attendeeName?: string;
  ticketType?: string;
  orderReference?: string;
  verificationMethod?: VerificationMethod;
  checkedInAt?: string;
};

type VerificationRequest =
  | {
      method: "qr";
      credential: string;
    }
  | {
      method: "manual";
      ticketCode: string;
    };

// ===========================================================
// CONSTANTS
// ===========================================================

const TICKET_PATTERN = /^AWN-2026-[A-F0-9]{16}$/;

const RESULT_MESSAGES: Record<string, string> = {
  valid: "Ticket verified. Entry authorised.",
  invalid_ticket: "This ticket ID does not exist.",
  invalid_qr: "QR credential is invalid or has been altered.",
  already_used: "This ticket has already been used.",
  payment_not_confirmed: "Payment is not confirmed. Entry denied.",
  cancelled: "This ticket has been cancelled.",
};

// ===========================================================
// HELPERS
// ===========================================================

function formatDate(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to access the camera.";
  }

  switch (error.name) {
    case "NotAllowedError":
      return "Camera permission was denied. Allow camera access in your browser settings.";

    case "NotFoundError":
      return "No camera was found on this device.";

    case "NotReadableError":
      return "The camera is already being used by another application.";

    case "OverconstrainedError":
      return "The requested camera is unavailable.";

    default:
      return error.message || "Unable to start the camera.";
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ===========================================================
// COMPONENT
// ===========================================================

export function GateScanner() {
  // =========================================================
  // STATE
  // =========================================================

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [manualCode, setManualCode] = useState("");

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState<GateResult | null>(null);


  // =========================================================
  // REFS
  // =========================================================

  const videoRef = useRef<HTMLVideoElement>(null);

  const controlsRef = useRef<ScannerControls | null>(null);

  const cameraGenerationRef = useRef(0);

  const processingRef = useRef(false);

  const mountedRef = useRef(false);


  // =========================================================
  // COMPONENT LIFECYCLE
  // =========================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      cameraGenerationRef.current += 1;

      controlsRef.current?.stop();

      controlsRef.current = null;
    };
  }, []);


  // =========================================================
  // STOP CAMERA
  // =========================================================

  const stopCamera = useCallback(() => {
    cameraGenerationRef.current += 1;

    controlsRef.current?.stop();

    controlsRef.current = null;

    setCameraActive(false);

    setCameraStarting(false);
  }, []);


  // =========================================================
  // VERIFY TICKET
  // =========================================================

  const verifyTicket = useCallback(
    async (payload: VerificationRequest) => {
      if (processingRef.current) {
        return;
      }

      processingRef.current = true;

      setBusy(true);
      setError("");
      setResult(null);

      try {
        const response = await fetch(
          "/api/admin/gate",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify(payload),
          },
        );

        const data: unknown = await response.json();

        // ---------------------------------------------------
        // HTTP ERROR VALIDATION
        // ---------------------------------------------------

        if (!response.ok) {
          const message =
            isRecord(data) &&
            typeof data.error === "string"
              ? data.error
              : "Ticket verification failed.";

          throw new Error(message);
        }

        // ---------------------------------------------------
        // RESPONSE OBJECT VALIDATION
        // ---------------------------------------------------

        if (!isRecord(data)) {
          throw new Error(
            "The server returned an invalid verification response.",
          );
        }

        const responseResult: unknown = data.result;

        if (!isRecord(responseResult)) {
          throw new Error(
            "The server returned an invalid verification result.",
          );
        }

        // ---------------------------------------------------
        // EXPLICIT STATUS TYPE NARROWING
        // ---------------------------------------------------

        const statusValue: unknown =
          responseResult.status;

        if (typeof statusValue !== "string") {
          throw new Error(
            "The server returned an invalid ticket status.",
          );
        }

        // TypeScript now knows that status is a string.
        const status: string = statusValue;

        // ---------------------------------------------------
        // MESSAGE
        // ---------------------------------------------------

        const messageValue: unknown =
          responseResult.message;

        const nextResult: GateResult = {
          status,

          message:
            typeof messageValue === "string"
              ? messageValue
              : RESULT_MESSAGES[status] ??
                "Verification could not be completed.",
        };

        // ---------------------------------------------------
        // OPTIONAL RESPONSE FIELDS
        // ---------------------------------------------------

        const ticketCode = responseResult.ticketCode;

        const attendeeName = responseResult.attendeeName;

        const ticketType = responseResult.ticketType;

        const orderReference = responseResult.orderReference;

        const verificationMethod =
          responseResult.verificationMethod;

        const checkedInAt = responseResult.checkedInAt;

        if (typeof ticketCode === "string") {
          nextResult.ticketCode = ticketCode;
        }

        if (typeof attendeeName === "string") {
          nextResult.attendeeName = attendeeName;
        }

        if (typeof ticketType === "string") {
          nextResult.ticketType = ticketType;
        }

        if (typeof orderReference === "string") {
          nextResult.orderReference = orderReference;
        }

        if (
          verificationMethod === "qr" ||
          verificationMethod === "manual"
        ) {
          nextResult.verificationMethod =
            verificationMethod;
        }

        if (typeof checkedInAt === "string") {
          nextResult.checkedInAt = checkedInAt;
        }

        // ---------------------------------------------------
        // UPDATE UI
        // ---------------------------------------------------

        if (mountedRef.current) {
          setResult(nextResult);

          if (status === "valid") {
            setManualCode("");
          }
        }

      } catch (caught) {
        if (mountedRef.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to verify ticket.",
          );
        }
      } finally {
        processingRef.current = false;

        if (mountedRef.current) {
          setBusy(false);
        }
      }
    },
    [],
  );


  // =========================================================
  // START CAMERA
  // =========================================================

  async function startCamera() {
    if (
      cameraActive ||
      cameraStarting ||
      busy
    ) {
      return;
    }

    setError("");
    setCameraError("");
    setResult(null);

    if (!videoRef.current) {
      setCameraError(
        "Camera preview is unavailable. Please refresh the page.",
      );

      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Camera access requires HTTPS or localhost. Open this page in a secure browser connection.",
      );

      return;
    }

    const generation =
      ++cameraGenerationRef.current;

    setCameraStarting(true);

    try {
      const reader = new BrowserQRCodeReader();

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,

        (decoded, _scanError, callbackControls) => {
          if (
            !decoded ||
            generation !== cameraGenerationRef.current ||
            processingRef.current
          ) {
            return;
          }

          const credential = decoded.getText().trim();

          if (!credential) {
            return;
          }

          // Stop scanning immediately after detection.
          cameraGenerationRef.current += 1;

          callbackControls.stop();

          if (
            controlsRef.current === callbackControls
          ) {
            controlsRef.current = null;
          }

          if (mountedRef.current) {
            setCameraActive(false);
            setCameraStarting(false);
          }

          if (credential.length > 256) {
            if (mountedRef.current) {
              setError(
                "The scanned QR credential is too long or invalid.",
              );
            }

            return;
          }

          // Validate the credential through the server.
          void verifyTicket({
            method: "qr",
            credential,
          });
        },
      );

      // If scanning was stopped during initialization,
      // immediately release the newly created controls.
      if (
        !mountedRef.current ||
        generation !== cameraGenerationRef.current
      ) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;

      setCameraActive(true);

    } catch (caught) {
      if (
        mountedRef.current &&
        generation === cameraGenerationRef.current
      ) {
        setCameraError(
          getErrorMessage(caught),
        );

        setCameraActive(false);
      }
    } finally {
      if (
        mountedRef.current &&
        generation === cameraGenerationRef.current
      ) {
        setCameraStarting(false);
      }
    }
  }


  // =========================================================
  // MANUAL TICKET VERIFICATION
  // =========================================================

  async function submitManual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    const ticketCode = manualCode
      .trim()
      .toUpperCase();

    if (!TICKET_PATTERN.test(ticketCode)) {
      setError(
        "Enter a valid ticket ID in the format AWN-2026-XXXXXXXXXXXXXXXX.",
      );

      return;
    }

    // Stop an active scanner before manual verification.
    if (cameraActive || cameraStarting) {
      stopCamera();
    }

    await verifyTicket({
      method: "manual",
      ticketCode,
    });
  }


  // =========================================================
  // RESULT HELPERS
  // =========================================================

  const isValid = result?.status === "valid";

  const isAlreadyUsed =
    result?.status === "already_used";

  const isRejected =
    result !== null &&
    !isValid &&
    !isAlreadyUsed;

  const resultVariant: "success" | "warning" | "danger" =
    isValid
      ? "success"
      : isAlreadyUsed
        ? "warning"
        : "danger";


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="admin-page gate-scanner">

      {/* PAGE HEADER */}

      <div className="admin-title">
        <Badge variant="gold">
          EVENT ENTRY MANAGEMENT
        </Badge>

        <h1>Gate check-in</h1>

        <p>
          Scan a guest's QR ticket or enter their
          ticket ID to verify admission.
        </p>
      </div>


      {/* GATE SECURITY STATUS */}

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <ShieldCheck size={22} />

          <div style={{ flex: 1 }}>
            <strong>
              Secure ticket verification
            </strong>

            <p className="muted">
              Each ticket can only be used once.
              Entry is authorised only after payment
              has been confirmed.
            </p>
          </div>

          <Badge variant="success">
            DATABASE VERIFIED
          </Badge>
        </div>
      </Card>


      {/* QR CAMERA SCANNER */}

      <Card>
        <div className="gate-section-heading">
          <div>
            <Camera size={22} />

            <div>
              <h2>QR ticket scanner</h2>

              <p className="muted">
                Use your device camera to scan a guest's
                individual QR ticket.
              </p>
            </div>
          </div>

          <Badge
            variant={
              cameraActive
                ? "success"
                : "neutral"
            }
          >
            {cameraActive
              ? "CAMERA ACTIVE"
              : cameraStarting
                ? "STARTING CAMERA"
                : "CAMERA OFF"}
          </Badge>
        </div>


        {/* CAMERA PREVIEW */}

        <div
          style={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            borderRadius: 14,
            background: "#111827",
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              display:
                cameraActive || cameraStarting
                  ? "block"
                  : "none",

              width: "100%",

              maxHeight: 480,

              objectFit: "cover",

              aspectRatio: "4 / 3",
            }}
          />

          {!cameraActive && !cameraStarting && (
            <div
              style={{
                color: "white",
                textAlign: "center",
                padding: 32,
              }}
            >
              <ScanLine
                size={48}
                style={{
                  margin: "0 auto 16px",
                }}
              />

              <strong>
                Camera scanner is inactive
              </strong>

              <p
                style={{
                  opacity: 0.7,
                  fontSize: 14,
                }}
              >
                Start the camera to scan guest tickets.
              </p>
            </div>
          )}

          {cameraActive && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "15%",
                border: "2px solid rgba(255,255,255,0.85)",
                borderRadius: 16,
                pointerEvents: "none",
              }}
            />
          )}
        </div>


        {/* CAMERA ERROR */}

        {cameraError && (
          <div
            className="error-box"
            role="alert"
          >
            <AlertTriangle size={16} />

            {cameraError}
          </div>
        )}


        {/* CAMERA CONTROLS */}

        <div className="gate-actions">
          {!cameraActive ? (
            <Button
              fullWidth
              onClick={() => void startCamera()}
              disabled={cameraStarting || busy}
            >
              <Camera size={17} />

              {cameraStarting
                ? "Starting camera…"
                : "Start camera scanner"}
            </Button>
          ) : (
            <Button
              fullWidth
              variant="outline"
              onClick={stopCamera}
              disabled={busy}
            >
              <CameraOff size={17} />

              Stop camera
            </Button>
          )}
        </div>

        <p className="muted">
          Camera access requires HTTPS or localhost.
          Allow camera permission when your browser
          requests it.
        </p>
      </Card>


      {/* MANUAL VERIFICATION */}

      <Card>
        <div className="gate-section-heading">
          <div>
            <Keyboard size={22} />

            <div>
              <h2>Manual ticket verification</h2>

              <p className="muted">
                Enter the ticket ID printed on a guest's
                digital ticket.
              </p>
            </div>
          </div>
        </div>

        <form
          className="form-stack"
          onSubmit={submitManual}
        >
          <div className="form-field">
            <label htmlFor="gate-ticket-code">
              Ticket ID
            </label>

            <input
              className="input"
              id="gate-ticket-code"
              value={manualCode}
              onChange={(event) =>
                setManualCode(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="AWN-2026-XXXXXXXXXXXXXXXX"
              maxLength={26}
              autoComplete="off"
              spellCheck={false}
              required
              disabled={busy}
            />

            <small className="muted">
              Enter the complete ticket ID, including
              AWN-2026-.
            </small>
          </div>

          <Button
            type="submit"
            fullWidth
            disabled={busy || !manualCode.trim()}
          >
            {busy
              ? "Verifying ticket…"
              : "Verify ticket manually"}

            <ShieldCheck size={17} />
          </Button>
        </form>
      </Card>


      {/* GENERAL ERROR */}

      {error && (
        <div
          className="error-box"
          role="alert"
        >
          <AlertTriangle size={16} />

          {error}
        </div>
      )}


      {/* VERIFICATION RESULT */}

      {result && (
        <Card>
          <div
            className="gate-result-heading"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {isValid ? (
              <CheckCircle2
                size={34}
                color="#16a34a"
              />
            ) : (
              <XCircle
                size={34}
                color="#dc2626"
              />
            )}

            <div>
              <Badge variant={resultVariant}>
                {result.status
                  .replaceAll("_", " ")
                  .toUpperCase()}
              </Badge>

              <h2>
                {isValid
                  ? "Entry authorised"
                  : isAlreadyUsed
                    ? "Ticket already used"
                    : "Entry denied"}
              </h2>
            </div>
          </div>

          <p
            className="muted"
            role="status"
            aria-live="polite"
          >
            {result.message}
          </p>


          {/* TICKET INFORMATION */}

          {result.ticketCode && (
            <div className="gate-result-details">

              <div className="summary-row">
                <span>Ticket ID</span>

                <strong>
                  {result.ticketCode}
                </strong>
              </div>

              {result.attendeeName && (
                <div className="summary-row">
                  <span>Attendee</span>

                  <strong>
                    {result.attendeeName}
                  </strong>
                </div>
              )}

              {result.ticketType && (
                <div className="summary-row">
                  <span>Ticket type</span>

                  <strong>
                    {result.ticketType}
                  </strong>
                </div>
              )}

              {result.orderReference && (
                <div className="summary-row">
                  <span>Order reference</span>

                  <strong>
                    {result.orderReference}
                  </strong>
                </div>
              )}

              {result.verificationMethod && (
                <div className="summary-row">
                  <span>Verification method</span>

                  <strong>
                    {result.verificationMethod === "qr"
                      ? "QR scan"
                      : "Manual lookup"}
                  </strong>
                </div>
              )}

              {result.checkedInAt && (
                <div className="summary-row">
                  <span>Check-in time</span>

                  <strong>
                    {formatDate(result.checkedInAt)}
                  </strong>
                </div>
              )}

            </div>
          )}


          {/* VALID RESULT */}

          {isValid && (
            <div
              className="payment-warning"
              style={{ marginTop: 16 }}
            >
              <ShieldCheck size={19} />

              <p>
                This ticket has been marked as used.
                The same ticket cannot authorise another
                entry.
              </p>
            </div>
          )}


          {/* REJECTED RESULT */}

          {isRejected && (
            <div
              className="error-box"
              style={{ marginTop: 16 }}
            >
              <AlertTriangle size={16} />

              Do not admit the guest using this ticket.
              Refer the case to an authorised event
              administrator.
            </div>
          )}


          {/* RESET */}

          <Button
            fullWidth
            variant="outline"
            onClick={() => {
              setResult(null);
              setError("");
              setManualCode("");
            }}
          >
            <RefreshCw size={16} />

            Verify another ticket
          </Button>
        </Card>
      )}


      {/* GATE REMINDER */}

      <p className="muted">
        <ShieldCheck
          size={15}
          style={{
            display: "inline",
            verticalAlign: "middle",
          }}
        />

        {" "}Only admit guests when the system returns
        a valid verification result. Never rely on a
        screenshot of a previously scanned ticket.
      </p>

    </div>
  );
}
