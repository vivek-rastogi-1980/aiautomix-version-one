"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createFinancialProjectAction } from "@/features/financials/actions";
import { CURRENCIES, CURRENCY_CODES } from "@/features/financials/money";
import {
  REVENUE_MODELS,
  REVENUE_MODEL_FORMULA,
  REVENUE_MODEL_LABELS,
} from "@/features/financials/types";
import type { FinancialPrefill } from "@/features/financials/data";
import { idleState } from "@/lib/forms/action-state";
import type { BusinessIdea, BusinessPlan } from "@/types/database";

/**
 * The financial model brief.
 *
 * Two fields carry more weight than the rest.
 *
 * CURRENCY is required with no default. Every amount in the model is in it, and
 * a model whose currency was assumed produces numbers that mean nothing.
 *
 * REVENUE MODEL picks the formula family. The form shows the formula next to
 * each option, because "subscribers x monthly price" and "GMV x take rate" are
 * different businesses and the user is choosing which arithmetic applies.
 */

interface FinancialFormProps {
  prefill: FinancialPrefill | null;
  estimatedCredits: number;
  ideas: Pick<BusinessIdea, "id" | "title">[];
  plans: Pick<BusinessPlan, "id" | "title">[];
  research: { id: string; title: string }[];
  competitors: { id: string; title: string }[];
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

export function FinancialForm({
  prefill,
  estimatedCredits,
  ideas,
  plans,
  research,
  competitors,
}: FinancialFormProps) {
  const [state, formAction] = useActionState(
    createFinancialProjectAction,
    idleState,
  );
  const errors = state.fieldErrors;

  const [currency, setCurrency] = useState<string>("INR");
  const [revenueModel, setRevenueModel] = useState<string>("SUBSCRIPTION");

  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !errors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      {prefill?.businessIdeaId ? (
        <input
          type="hidden"
          name="businessIdeaId"
          value={prefill.businessIdeaId}
        />
      ) : null}
      {prefill?.businessPlanId ? (
        <input
          type="hidden"
          name="businessPlanId"
          value={prefill.businessPlanId}
        />
      ) : null}

      {prefill ? (
        <Card className="flex flex-wrap items-center gap-x-2 gap-y-1 border-brand-violet/30 bg-brand-violet/5 px-5 py-4 text-sm">
          <span className="text-muted">Financials for:</span>
          <Link
            href={prefill.sourceHref}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {prefill.sourceLabel}
          </Link>
          <span className="w-full text-xs text-muted-strong">
            Values carried across are labelled as inherited assumptions — real,
            but not automatically true of this model. Edit anything before you
            start.
          </span>
        </Card>
      ) : null}

      <FormSection
        title="The business"
        description="What is being modelled. Specifics here make the proposed assumptions far better."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="title">Model title *</Label>
          <Input
            id="title"
            name="title"
            defaultValue={prefill?.title ?? ""}
            placeholder="Financials — Acme Scheduling"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.title)}
          />
          <FieldError>{errors?.title}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="description">Business description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={prefill?.description ?? ""}
            placeholder="What the business sells, to whom, and how it delivers."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.description)}
          />
          <FieldError>{errors?.description}</FieldError>
        </div>

        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={prefill?.industry ?? ""}
            placeholder="Healthcare software"
            className="mt-1.5"
          />
          <FieldError>{errors?.industry}</FieldError>
        </div>

        <div>
          <Label htmlFor="geography">Geography</Label>
          <Input
            id="geography"
            name="geography"
            defaultValue={prefill?.geography ?? ""}
            placeholder="India"
            className="mt-1.5"
          />
          <FieldError>{errors?.geography}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="targetCustomer">Target customer</Label>
          <Textarea
            id="targetCustomer"
            name="targetCustomer"
            rows={2}
            defaultValue={prefill?.targetCustomer ?? ""}
            placeholder="Independent dental clinics with 1-5 chairs."
            className="mt-1.5"
          />
          <FieldError>{errors?.targetCustomer}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Money"
        description="The currency applies to every figure in this model. There is no conversion — one model, one currency."
      >
        <div>
          <Label htmlFor="currency">Currency *</Label>
          <Select
            id="currency"
            name="currency"
            className="mt-1.5"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCIES[code].label}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.currency}</FieldError>
        </div>

        <div>
          <Label htmlFor="openingCash">
            Cash available today{" "}
            <span className="font-normal text-muted-strong">({symbol})</span>
          </Label>
          <Input
            id="openingCash"
            name="openingCash"
            inputMode="decimal"
            placeholder="500000"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.openingCash)}
            aria-describedby={
              errors?.openingCash ? undefined : "openingCash-hint"
            }
          />
          {errors?.openingCash ? (
            <FieldError>{errors.openingCash}</FieldError>
          ) : (
            <p
              id="openingCash-hint"
              className="mt-1.5 text-xs text-muted-strong"
            >
              Plain amount, no symbol. This sets the runway calculation.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="horizonMonths">Forecast horizon (months)</Label>
          <Input
            id="horizonMonths"
            name="horizonMonths"
            type="number"
            min={1}
            max={60}
            defaultValue={12}
            className="mt-1.5"
            aria-invalid={Boolean(errors?.horizonMonths)}
          />
          <FieldError>{errors?.horizonMonths}</FieldError>
        </div>
      </FormSection>

      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Revenue model
        </h2>
        <p className="mt-1 text-sm text-muted">
          This chooses the formula the engine uses. It is not a label — the
          arithmetic genuinely differs.
        </p>

        <fieldset className="mt-6">
          <legend className="sr-only">Revenue model</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REVENUE_MODELS.map((model) => {
              const active = model === revenueModel;
              return (
                <label
                  key={model}
                  className={`flex cursor-pointer flex-col rounded-2xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-brand-violet ${
                    active
                      ? "border-brand-violet/60 bg-brand-violet/10"
                      : "border-line bg-fill-2 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="revenueModel"
                      value={model}
                      checked={active}
                      onChange={() => setRevenueModel(model)}
                      className="size-4 accent-brand-violet"
                    />
                    <span className="font-display text-sm font-bold tracking-tight text-foreground">
                      {REVENUE_MODEL_LABELS[model]}
                    </span>
                  </span>
                  <span className="mt-2 font-mono text-xs text-muted">
                    {REVENUE_MODEL_FORMULA[model]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <FieldError>{errors?.revenueModel}</FieldError>
      </Card>

      {!prefill &&
      (ideas.length > 0 ||
        plans.length > 0 ||
        research.length > 0 ||
        competitors.length > 0) ? (
        <FormSection
          title="Inherit from earlier work"
          description="Linking market or competitor research is what turns a guessed price into an evidence-backed one. Nothing is copied — the link is stored as a reference."
        >
          {ideas.length > 0 ? (
            <div>
              <Label htmlFor="businessIdeaId">Business idea</Label>
              <Select
                id="businessIdeaId"
                name="businessIdeaId"
                className="mt-1.5"
              >
                <option value="">None</option>
                {ideas.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {plans.length > 0 ? (
            <div>
              <Label htmlFor="businessPlanId">Business plan</Label>
              <Select
                id="businessPlanId"
                name="businessPlanId"
                className="mt-1.5"
              >
                <option value="">None</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {research.length > 0 ? (
            <div>
              <Label htmlFor="researchRequestId">Market research</Label>
              <Select
                id="researchRequestId"
                name="researchRequestId"
                className="mt-1.5"
              >
                <option value="">None</option>
                {research.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-muted-strong">
                Supplies pricing evidence to the revenue stage.
              </p>
            </div>
          ) : null}

          {competitors.length > 0 ? (
            <div>
              <Label htmlFor="competitorProjectId">Competitor research</Label>
              <Select
                id="competitorProjectId"
                name="competitorProjectId"
                className="mt-1.5"
              >
                <option value="">None</option>
                {competitors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-muted-strong">
                Supplies competitor pricing as a benchmark, not a commitment.
              </p>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Estimated usage
        </h2>
        <p
          role="status"
          className="mt-3 rounded-xl border border-line bg-fill-2 px-4 py-3 text-sm text-muted"
        >
          <strong className="font-semibold text-foreground">
            About {estimatedCredits} credits
          </strong>{" "}
          for the whole model. Only five of the eight stages call an AI — the
          unit economics, scenarios and cash-flow stages are calculated by the
          engine and cost nothing. Credits are charged per stage as it runs, and
          a failed stage is refunded.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="lg" pendingText="Creating…">
          <Calculator className="size-4" /> Create financial model
        </SubmitButton>
        <p className="text-sm text-muted">
          Nothing runs yet. You start the first stage from the model page.
        </p>
      </div>
    </form>
  );
}
