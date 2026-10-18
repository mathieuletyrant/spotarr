import { type Share, Summary } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Film, Sparkles } from "lucide-react";
import { Candidates } from "../../components/share/candidate-card";
import { Card } from "../../components/share/card";
import { CluesCard } from "../../components/share/clues-card";
import { ShareHeader } from "../../components/share/share-header";
import { waitingText } from "../../lib/effort";
import { shareQuery } from "../../queries/shares";

export const Route = createFileRoute("/_app/shares/$shareId")({ component: SharePage });

function SharePage() {
  const { shareId } = Route.useParams();
  const { data, isPending, error } = useQuery(shareQuery(shareId));

  if (isPending) return <p className="text-text-muted">Loading…</p>;
  if (error) return <p className="text-status-error">{error.message}</p>;
  const share = data.share;
  if (!share) return null;

  return (
    <div className="flex flex-col gap-6">
      <ShareHeader share={share} />
      {/* grid-cols-1 keeps the column to the screen's width on a phone: an implicit
          column would grow to fit the frames. The Candidates come first and wider:
          that is where the choice is made; the Clues explain it beside them. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
        <Card icon={<Film aria-hidden className="size-4" />} title="Candidates">
          {share.summary === Summary.IN_PROGRESS ? (
            <p className="text-text-muted">
              Identifying… {waitingText(share.identification?.effort)}; the page follows on its own.
            </p>
          ) : share.candidates.length === 0 ? (
            <NoCandidates share={share} />
          ) : (
            <Candidates share={share} />
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <CluesCard share={share} />
          {share.identification?.reasoning && (
            <Card icon={<Sparkles aria-hidden className="size-4" />} title="LLM reasoning">
              <p className="rounded-lg bg-accent/10 p-4 leading-relaxed">
                {share.identification.reasoning}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Why there is nothing to add: the error when the Identification failed, so a
// failure does not read like a reel with no film in it.
function NoCandidates({ share }: { share: Share }) {
  if (share.failureReason) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-status-error">The identification failed: {share.failureReason}</p>
        <p className="text-text-muted">Retry it, with more effort or a hint, or open the source.</p>
      </div>
    );
  }
  return (
    <p className="text-text-muted">No candidates. Retry the identification, or open the source.</p>
  );
}
