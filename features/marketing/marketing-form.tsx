"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createGtmProjectAction } from "@/features/marketing/actions";
import { CURRENCIES, CURRENCY_CODES } from "@/features/financials/money";
import {
  GTM_MOTIONS,
  GTM_MOTION_DESCRIPTIONS,
  GTM_MOTION_LABELS,
} from "@/features/marketing/types";
import type { GtmContextOptions, GtmPrefill } from "@/features/marketing/data";
import { idleState } from "@/lib/forms/action-state";

/**
 * The go-to-market brief.
 *
 * Three fields carry more weight than the rest, and the form says so rather
 * than burying them among the optional ones.
 *
 * CURRENCY is required with no default. Every money figure in the plan is in
 * it, and a budget whose currency was assumed means nothing.
 *
 * MOTION decides the funnel template, the applicable KPIs and the shape of
 * every later stage. It is optional here because the planning stage can propose
 * it — but a user who already knows should say so, because a model inferring
 * "SaaS" for a dental clinic propagates into all eight stages.
 *
 * FINANCIAL MODEL is what makes acquisition economics possible at all. Without
 * one there is no revenue per customer, and the compute stage refuses to invent
 * one rather than producing a budget out of nothing. The form warns up front
 * instead of letting the user discover that at stage seven.
 */

interface MarketingFormProps {
  prefill: GtmPrefill | null;
  estimatedCredits: number;
  options: GtmContextOptions;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </Card>
  );
}

export function MarketingForm({
  prefill,
  estimatedCredits,
  options,
}: MarketingFormProps) {
  const [state, formAction] = useActionState(createGtmProjectAction, idleState);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.status === "error" && state.message ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      <FormSection
        title="What are you taking to market?"
        description="Everything downstream is built on this. Be specific — a plan for 'a booking tool' is a plan for nobody."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="title">Plan title</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={prefill?.title ?? ""}
            placeholder="Go-to-market — appointment reminders for dental clinics"
          />
          <FieldError>{errors?.title}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="description">What it does</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={prefill?.description ?? ""}
            placeholder="One paragraph a stranger would understand."
          />
          <FieldError>{errors?.description}</FieldError>
        </div>

        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={prefill?.industry ?? ""}
            placeholder="Dental practice software"
          />
          <FieldError>{errors?.industry}</FieldError>
        </div>

        <div>
          <Label htmlFor="geography">Geography</Label>
          <Input
            id="geography"
            name="geography"
            defaultValue={prefill?.geography ?? ""}
            placeholder="India — tier 1 and tier 2 cities"
          />
          <FieldError>{errors?.geography}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="How you sell"
        description="The motion decides the funnel. A clinic taking bookings and a tool someone signs up for with a card are not the same shape, and forcing one into the other is how plans become generic."
      >
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select id="currency" name="currency" required defaultValue="">
            <option value="" disabled>
              Choose a currency…
            </option>
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCIES[code].symbol}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            Required. Every figure in this plan will be stated in it.
          </p>
          <FieldError>{errors?.currency}</FieldError>
        </div>

        <div>
          <Label htmlFor="motion">Selling motion</Label>
          <Select id="motion" name="motion" defaultValue="">
            <option value="">Let the planning stage decide</option>
            {GTM_MOTIONS.map((motion) => (
              <option key={motion} value={motion}>
                {GTM_MOTION_LABELS[motion]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {GTM_MOTION_DESCRIPTIONS.FIELD_LOCAL}
          </p>
          <FieldError>{errors?.motion}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Targets and acquisition policy"
        description="These are decisions, not predictions. The engine calculates what they would require; it never tells you they will happen."
      >
        <div>
          <Label htmlFor="targetNewCustomers">New customers wanted</Label>
          <Input
            id="targetNewCustomers"
            name="targetNewCustomers"
            type="number"
            min={0}
            defaultValue={50}
          />
          <p className="mt-1 text-xs text-muted">
            A target you are choosing. Everything derived from it is &ldquo;what
            this would take&rdquo;, not a forecast.
          </p>
          <FieldError>{errors?.targetNewCustomers}</FieldError>
        </div>

        <div>
          <Label htmlFor="targetHorizonMonths">Over how many months</Label>
          <Input
            id="targetHorizonMonths"
            name="targetHorizonMonths"
            type="number"
            min={1}
            max={24}
            defaultValue={12}
          />
          <FieldError>{errors?.targetHorizonMonths}</FieldError>
        </div>

        <div>
          <Label htmlFor="paybackMonths">CAC payback window (months)</Label>
          <Input
            id="paybackMonths"
            name="paybackMonths"
            type="number"
            min={1}
            max={60}
            defaultValue={6}
          />
          <p className="mt-1 text-xs text-muted">
            How many months of gross profit you will spend to win one customer.
          </p>
          <FieldError>{errors?.paybackMonths}</FieldError>
        </div>

        <div>
          <Label htmlFor="targetLtvCacRatio">Target LTV:CAC</Label>
          <Input
            id="targetLtvCacRatio"
            name="targetLtvCacRatio"
            defaultValue="3"
            placeholder="3"
            inputMode="decimal"
          />
          <p className="mt-1 text-xs text-muted">
            A multiple, for example 3 for 3x. The lower of this and the payback
            window becomes your allowable CAC.
          </p>
          <FieldError>{errors?.targetLtvCacBps}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Build on existing work"
        description="Linked records are read as compact summaries, not pasted wholesale. A financial model is the one that matters most."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="financialProjectId">Financial model</Label>
          <Select
            id="financialProjectId"
            name="financialProjectId"
            defaultValue=""
          >
            <option value="">None</option>
            {options.financials.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.currency})
              </option>
            ))}
          </Select>
          {options.financials.length === 0 ? (
            <p className="mt-1 text-xs text-accent">
              You have no financial models yet. Acquisition economics needs
              revenue per customer and gross margin from one, and it will refuse
              to invent them — so that stage will fail until you build and link
              a financial model.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Supplies revenue per customer, gross margin and churn to the
              acquisition calculation. Without it, that stage cannot run.
            </p>
          )}
          <FieldError>{errors?.financialProjectId}</FieldError>
        </div>

        <div>
          <Label htmlFor="businessIdeaId">Business idea</Label>
          <Select
            id="businessIdeaId"
            name="businessIdeaId"
            defaultValue={prefill?.businessIdeaId ?? ""}
          >
            <option value="">None</option>
            {options.ideas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.businessIdeaId}</FieldError>
        </div>

        <div>
          <Label htmlFor="businessPlanId">Business plan</Label>
          <Select
            id="businessPlanId"
            name="businessPlanId"
            defaultValue={prefill?.businessPlanId ?? ""}
          >
            <option value="">None</option>
            {options.plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.businessPlanId}</FieldError>
        </div>

        <div>
          <Label htmlFor="researchRequestId">Market research</Label>
          <Select
            id="researchRequestId"
            name="researchRequestId"
            defaultValue=""
          >
            <option value="">None</option>
            {options.research.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.researchRequestId}</FieldError>
        </div>

        <div>
          <Label htmlFor="competitorProjectId">Competitor analysis</Label>
          <Select
            id="competitorProjectId"
            name="competitorProjectId"
            defaultValue=""
          >
            <option value="">None</option>
            {options.competitors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            Used to check differentiators before any of them is called unique.
          </p>
          <FieldError>{errors?.competitorProjectId}</FieldError>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          A full run costs{" "}
          <span className="font-semibold text-foreground">
            {estimatedCredits} credits
          </span>{" "}
          across eight stages. Acquisition economics is calculated and free.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/marketing"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </Link>
          <SubmitButton>
            <Megaphone className="size-4" /> Create plan
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
