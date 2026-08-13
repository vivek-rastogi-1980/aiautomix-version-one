import {
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ABSENT_LABELS,
  CLAIM_KIND_LABELS,
  CLAIM_KIND_MEANING,
  COMPETITOR_TYPE_LABELS,
  COMPETITOR_TYPE_MEANING,
  VERIFICATION_LABELS,
  VERIFICATION_MEANING,
  displayValue,
  isAbsentValue,
  type ClaimKind,
  type CompetitorType,
  type VerificationStatus,
} from "@/features/competitors/types";
import type { CompetitorRow } from "@/types/database";

/**
 * The competitor list, and the per-competitor detail card.
 *
 * Three things this component refuses to do, each of which would make the page
 * look better and the product worse.
 *
 *   It does not hide unverified competitors. A name that surfaced and could not
 *   be confirmed is a finding; dropping it would make the list look cleaner
 *   than the evidence supports. It is shown, last, clearly labelled.
 *
 *   It does not render an empty cell for missing data. `UNKNOWN`,
 *   `NOT_PUBLICLY_AVAILABLE` and `INSUFFICIENT_EVIDENCE` are different facts
 *   about the market and each is printed as words.
 *
 *   It does not present a competitor's own marketing as an observation. Every
 *   claim carries STATED / OBSERVED / INFERRED / RECOMMENDED as a word.
 */

const VERIFICATION_META: Record<
  VerificationStatus,
  {
    icon: typeof ShieldCheck;
    variant: "active" | "completed" | "archived" | "neutral";
    className: string;
  }
> = {
  VERIFIED: {
    icon: ShieldCheck,
    variant: "active",
    className: "text-brand-green",
  },
  PARTIALLY_VERIFIED: {
    icon: ShieldAlert,
    variant: "completed",
    className: "text-accent",
  },
  UNVERIFIED: {
    icon: ShieldX,
    variant: "archived",
    className: "text-danger-soft",
  },
  PENDING: { icon: Clock, variant: "neutral", className: "text-muted-strong" },
};

const TYPE_VARIANT: Record<
  CompetitorType,
  "brand" | "completed" | "paused" | "neutral"
> = {
  DIRECT: "brand",
  INDIRECT: "completed",
  EMERGING: "paused",
  UNCLASSIFIED: "neutral",
};

const KIND_STYLE: Record<ClaimKind, string> = {
  STATED: "border-accent-lime/40 bg-accent-lime/10 text-accent-lime",
  OBSERVED: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  INFERRED: "border-brand-cyan/40 bg-brand-cyan/10 text-accent",
  RECOMMENDED: "border-brand-violet/40 bg-brand-violet/10 text-brand-violet",
};

/** Refuse to build an `href` from anything that is not http(s). */
function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

interface ProfileShape {
  description?: unknown;
  targetCustomer?: unknown;
  geography?: unknown;
  productService?: unknown;
  businessModel?: unknown;
  valueProposition?: unknown;
  offering?: unknown;
  features?: { name?: unknown; kind?: unknown }[];
  integrations?: unknown[];
  strengths?: unknown[];
  weaknesses?: unknown[];
}

interface PricingShape {
  model?: unknown;
  plans?: {
    planName?: unknown;
    displayedPrice?: unknown;
    billingFrequency?: unknown;
  }[];
  freeTrial?: unknown;
  freePlan?: unknown;
  enterpriseCustom?: unknown;
  pricingSource?: unknown;
}

interface PositioningShape {
  headline?: unknown;
  primaryBenefit?: unknown;
  differentiation?: unknown;
  messagingThemes?: unknown[];
  strategy?: unknown;
  basis?: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

export function CompetitorList({
  competitors,
}: {
  competitors: CompetitorRow[];
}) {
  if (competitors.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No competitors found yet
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Discovery searches the web and keeps only companies a real search
          result backs. Run that stage to populate this list.
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {competitors.map((competitor) => (
        <li key={competitor.id}>
          <CompetitorCard competitor={competitor} />
        </li>
      ))}
    </ul>
  );
}

export function CompetitorCard({ competitor }: { competitor: CompetitorRow }) {
  const status = (competitor.verification_status ??
    "PENDING") as VerificationStatus;
  const type = (competitor.competitor_type ?? "UNCLASSIFIED") as CompetitorType;
  const meta = VERIFICATION_META[status] ?? VERIFICATION_META.PENDING;
  const Icon = meta.icon;

  const href = safeHref(competitor.website);
  const profile = (competitor.profile ?? {}) as ProfileShape;
  const pricing = (competitor.pricing ?? {}) as PricingShape;
  const positioning = (competitor.positioning ?? {}) as PositioningShape;

  const headingId = `competitor-${competitor.id}`;

  return (
    <Card
      className={cn(
        "p-5 sm:p-6",
        status === "UNVERIFIED" ? "border-dashed opacity-90" : null,
      )}
    >
      <article aria-labelledby={headingId}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3
              id={headingId}
              className="font-display text-base font-bold tracking-tight text-foreground"
            >
              {competitor.name}
            </h3>
            <p className="mt-0.5 break-words text-xs text-muted">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
                >
                  {competitor.canonical_domain}
                  <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                competitor.canonical_domain
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={TYPE_VARIANT[type]}
              title={COMPETITOR_TYPE_MEANING[type]}
            >
              {COMPETITOR_TYPE_LABELS[type]}
            </Badge>
            {/* The verification state is a word plus an icon, never colour
                alone — it is the single most important thing on this card. */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                meta.className,
              )}
              title={VERIFICATION_MEANING[status]}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {VERIFICATION_LABELS[status]}
            </span>
          </div>
        </div>

        {status === "UNVERIFIED" ? (
          <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger-soft">
            This company could not be confirmed from public sources. Treat it as
            a lead to check, not as a competitor.
          </p>
        ) : null}

        {competitor.verification_notes ? (
          <p className="mt-3 text-xs text-muted">
            {competitor.verification_notes}
          </p>
        ) : null}

        {/* --- Profile ---------------------------------------------------- */}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field
            label="What they offer"
            value={
              str(profile.productService) ??
              str(profile.offering) ??
              str(profile.description)
            }
          />
          <Field label="Target customer" value={str(profile.targetCustomer)} />
          <Field label="Geography" value={str(profile.geography)} />
          <Field label="Business model" value={str(profile.businessModel)} />
          <div className="sm:col-span-2">
            <Field
              label="Value proposition"
              value={str(profile.valueProposition)}
            />
          </div>
        </dl>

        {/* --- Positioning ------------------------------------------------ */}
        {str(positioning.headline) ||
        str(positioning.primaryBenefit) ||
        str(positioning.differentiation) ? (
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
              Positioning
            </h4>
            {str(positioning.headline) ? (
              <p className="mt-2 flex flex-wrap items-start gap-2 text-sm text-muted">
                <ClaimTag
                  kind={
                    positioning.basis === "OBSERVED" ? "STATED" : "INFERRED"
                  }
                />
                <span className="min-w-0 flex-1">
                  {displayValue(String(positioning.headline))}
                </span>
              </p>
            ) : null}
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Field
                label="Primary benefit"
                value={str(positioning.primaryBenefit)}
              />
              <Field
                label="Differentiation"
                value={str(positioning.differentiation)}
              />
            </dl>
            {strList(positioning.messagingThemes).length > 0 ? (
              <p className="mt-2 text-xs text-muted-strong">
                Themes: {strList(positioning.messagingThemes).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* --- Pricing ---------------------------------------------------- */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Pricing
          </h4>
          <PricingBlock pricing={pricing} />
        </div>

        {/* --- Features --------------------------------------------------- */}
        {Array.isArray(profile.features) && profile.features.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
              Features
            </h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.features.slice(0, 20).map((feature, index) => {
                const name = str(feature?.name);
                if (!name) return null;
                const kind = (
                  typeof feature?.kind === "string" ? feature.kind : "INFERRED"
                ) as ClaimKind;
                return (
                  <li
                    key={index}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill-2 px-2.5 py-1 text-xs text-muted"
                    title={CLAIM_KIND_MEANING[kind] ?? undefined}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-strong">
                      {kind}
                    </span>
                    {name}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* --- Strengths and weaknesses ----------------------------------- */}
        {strList(profile.strengths).length > 0 ||
        strList(profile.weaknesses).length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PointList
              title="Strengths"
              items={strList(profile.strengths, 10)}
            />
            <PointList
              title="Weaknesses"
              items={strList(profile.weaknesses, 10)}
            />
          </div>
        ) : null}

        {strList(profile.integrations).length > 0 ? (
          <p className="mt-4 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide text-muted-strong">
              Integrations:{" "}
            </span>
            {strList(profile.integrations, 20).join(", ")}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-muted-strong">
          Confidence in this profile: {competitor.confidence}
        </p>
      </article>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm",
          value && !isAbsentValue(value) ? "text-muted" : "text-muted-strong",
        )}
      >
        {displayValue(value)}
      </dd>
    </div>
  );
}

function ClaimTag({ kind }: { kind: ClaimKind }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-tight",
        KIND_STYLE[kind],
      )}
      title={CLAIM_KIND_MEANING[kind]}
    >
      {CLAIM_KIND_LABELS[kind]}
    </span>
  );
}

function PointList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {title}
      </h5>
      <ul className="mt-1.5 flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm text-muted">
            <span aria-hidden="true" className="text-muted-strong">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pricing, or an honest statement that there is none.
 *
 * "Pricing not publicly disclosed" is the single most common correct answer
 * here, and the one a reader most needs to be able to distinguish from "we did
 * not look". Both are printed, differently.
 */
function PricingBlock({ pricing }: { pricing: PricingShape }) {
  const plans = Array.isArray(pricing.plans) ? pricing.plans : [];
  const model = str(pricing.model);

  if (plans.length === 0) {
    const reason = model && isAbsentValue(model) ? model : null;
    return (
      <p className="mt-2 text-sm text-muted-strong">
        {reason === "NOT_PUBLICLY_AVAILABLE"
          ? "Pricing not publicly disclosed."
          : reason === "INSUFFICIENT_EVIDENCE"
            ? "Conflicting pricing information — nothing could be confirmed."
            : "Pricing not publicly disclosed, or not found."}
      </p>
    );
  }

  return (
    <>
      {model && !isAbsentValue(model) ? (
        <p className="mt-2 text-sm text-muted">Model: {model}</p>
      ) : null}
      {/* A list rather than a table: four columns cannot fit a phone without
          horizontal scrolling, and these rows stack cleanly. */}
      <ul className="mt-2 flex flex-col gap-1.5">
        {plans.slice(0, 12).map((plan, index) => {
          const name = str(plan?.planName);
          if (!name) return null;
          const price = str(plan?.displayedPrice);
          const frequency = str(plan?.billingFrequency);
          return (
            <li
              key={index}
              className="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <span className="font-medium text-foreground">{name}</span>
              <span
                className={cn(
                  price && !isAbsentValue(price)
                    ? "text-muted"
                    : "text-muted-strong",
                )}
              >
                {displayValue(price)}
              </span>
              {frequency && !isAbsentValue(frequency) ? (
                <span className="text-xs text-muted-strong">{frequency}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-strong">
        <Inline label="Free trial" value={str(pricing.freeTrial)} />
        <Inline label="Free plan" value={str(pricing.freePlan)} />
        <Inline label="Enterprise" value={str(pricing.enterpriseCustom)} />
        <Inline label="Source" value={str(pricing.pricingSource)} />
      </dl>
    </>
  );
}

function Inline({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="text-muted">
        {isAbsentValue(value) ? ABSENT_LABELS[value] : value}
      </dd>
    </div>
  );
}
