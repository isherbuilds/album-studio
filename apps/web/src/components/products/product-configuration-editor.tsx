import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";

import { type ProductEditor, type ProductEditorConfiguration } from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@tsu-stack/ui/components/accordion";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Checkbox } from "@tsu-stack/ui/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Label } from "@tsu-stack/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger
} from "@tsu-stack/ui/components/select";
import { Separator } from "@tsu-stack/ui/components/separator";

import { getInventoryListQueryOptions } from "@/hooks/use-inventory";

import { labelOrFallback } from "./format";

type EditorGroup = ProductEditor["groups"][number];
type GroupType = EditorGroup["type"];

type EditableRequirement = {
  groupKey: string;
  optionValueIds: string[];
};
type EditableValue = {
  uid: string;
  persisted: boolean;
  id: string;
  label: string;
  imageUrl: string | null;
  componentIds: string[];
  requirements: EditableRequirement[];
};
type EditableDiscreteGroup = {
  uid: string;
  persisted: boolean;
  type: "single" | "boolean";
  key: string;
  label: string;
  required: boolean;
  values: EditableValue[];
};
type EditableNumberGroup = {
  uid: string;
  persisted: boolean;
  type: "number";
  key: string;
  label: string;
  required: boolean;
  included: number;
  maximum: number;
  minimum: number;
  step: number;
};
type EditableGroup = EditableDiscreteGroup | EditableNumberGroup;

// Deterministic ids keep SSR and first client render identical; click-created
// rows mint client-only ids after hydration, so they never diverge.
let newRowCounter = 0;
function nextUid(): string {
  newRowCounter += 1;
  return `new-${newRowCounter}`;
}

function toEditableGroups(groups: ProductEditor["groups"]): EditableGroup[] {
  return groups.map((group, groupIndex) => {
    if (group.type === "number") {
      return {
        included: group.included,
        key: group.key,
        label: group.label,
        maximum: group.maximum,
        minimum: group.minimum,
        persisted: true,
        required: group.required,
        step: group.step,
        type: "number",
        uid: `g${groupIndex}`
      };
    }
    return {
      key: group.key,
      label: group.label,
      persisted: true,
      required: group.required,
      type: group.type,
      uid: `g${groupIndex}`,
      values: group.values.map((value, valueIndex) => {
        return {
          componentIds: [...value.componentIds],
          id: value.id,
          imageUrl: value.imageUrl,
          label: value.label,
          persisted: true,
          requirements: value.requirements.map((requirement) => {
            return {
              groupKey: requirement.groupKey,
              optionValueIds: [...requirement.optionValueIds]
            };
          }),
          uid: `g${groupIndex}-v${valueIndex}`
        };
      })
    };
  });
}

function toConfiguration(groups: EditableGroup[]): ProductEditorConfiguration {
  return groups.map((group) => {
    if (group.type === "number") {
      return {
        included: group.included,
        key: group.key,
        label: group.label,
        maximum: group.maximum,
        minimum: group.minimum,
        required: group.required,
        step: group.step,
        type: "number"
      };
    }
    return {
      key: group.key,
      label: group.label,
      required: group.required,
      type: group.type,
      values: group.values.map((value) => {
        return {
          componentIds: value.componentIds,
          id: value.id,
          imageUrl: value.imageUrl === "" ? null : value.imageUrl,
          label: value.label,
          requirements: value.requirements.filter(
            (requirement) => requirement.optionValueIds.length > 0
          )
        };
      })
    };
  }) as ProductEditorConfiguration;
}

const groupTypeLabel: Record<GroupType, () => string> = {
  boolean: m.products__group_boolean,
  number: m.products__group_number,
  single: m.products__group_single
};

function NumberField({
  id,
  label,
  onChange,
  value
}: {
  id: string;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        min="0"
        onChange={(event) => {
          if (event.target.value === "") return;
          const nextValue = Number(event.target.value);
          if (!Number.isInteger(nextValue) || nextValue < 0) return;
          onChange(nextValue);
        }}
        type="number"
        value={value}
      />
    </Field>
  );
}

function RequirementEditor({
  earlierGroups,
  onChange,
  requirements
}: {
  earlierGroups: EditableDiscreteGroup[];
  onChange: (requirements: EditableRequirement[]) => void;
  requirements: EditableRequirement[];
}) {
  const baseId = useId();
  if (earlierGroups.length === 0) {
    return <p className="text-xs text-muted-foreground">{m.products__no_prerequisites()}</p>;
  }
  const setForGroup = (groupKey: string, optionValueIds: string[]) => {
    const others = requirements.filter((requirement) => requirement.groupKey !== groupKey);
    onChange(optionValueIds.length === 0 ? others : [...others, { groupKey, optionValueIds }]);
  };
  return (
    <div className="flex flex-col gap-3">
      {earlierGroups.map((group) => {
        const selected =
          requirements.find((requirement) => requirement.groupKey === group.key)?.optionValueIds ??
          [];
        return (
          <fieldset className="flex flex-col gap-1.5" key={group.uid}>
            <legend className="text-xs font-medium text-muted-foreground">
              {m.products__requires_from({ group: labelOrFallback(group.label, group.key) })}
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {group.values.length === 0 ? (
                <span className="text-xs text-muted-foreground">{m.products__no_values()}</span>
              ) : (
                group.values.map((value) => {
                  const checkboxId = `${baseId}-${group.uid}-${value.uid}`;
                  const checked = selected.includes(value.id);
                  return (
                    <Label className="gap-2 font-normal" htmlFor={checkboxId} key={value.uid}>
                      <Checkbox
                        checked={checked}
                        id={checkboxId}
                        onCheckedChange={(next) =>
                          setForGroup(
                            group.key,
                            next
                              ? [...selected, value.id]
                              : selected.filter((id) => id !== value.id)
                          )
                        }
                      />
                      {labelOrFallback(value.label, value.id)}
                    </Label>
                  );
                })
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function ValueEditor({
  components,
  earlierGroups,
  onChange,
  onRemove,
  value
}: {
  components: { id: string; name: string }[];
  earlierGroups: EditableDiscreteGroup[];
  onChange: (patch: Partial<EditableValue>) => void;
  onRemove: () => void;
  value: EditableValue;
}) {
  const baseId = useId();
  return (
    <AccordionItem value={value.uid}>
      <AccordionTrigger className="items-center">
        <span className="min-w-0">
          <strong className="block truncate">{labelOrFallback(value.label, value.id)}</strong>
          <span className="block truncate font-mono text-[11px] font-normal text-muted-foreground">
            {value.id}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${baseId}-id`}>{m.products__value_id()}</FieldLabel>
            <Input
              disabled={value.persisted}
              id={`${baseId}-id`}
              onChange={(event) => onChange({ id: event.target.value })}
              value={value.id}
            />
            {value.persisted ? (
              <FieldDescription>{m.products__identifier_locked()}</FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${baseId}-label`}>{m.products__value_label()}</FieldLabel>
            <Input
              id={`${baseId}-label`}
              onChange={(event) => onChange({ label: event.target.value })}
              value={value.label}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${baseId}-image`}>{m.products__value_image()}</FieldLabel>
          <Input
            id={`${baseId}-image`}
            onChange={(event) => onChange({ imageUrl: event.target.value })}
            placeholder="https://"
            value={value.imageUrl ?? ""}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">{m.products__components()}</p>
          <p className="text-xs text-muted-foreground">{m.products__components_hint()}</p>
          {components.length === 0 ? (
            <span className="text-xs text-muted-foreground">{m.products__no_components()}</span>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-0.5">
              {components.map((component) => {
                const checkboxId = `${baseId}-component-${component.id}`;
                const checked = value.componentIds.includes(component.id);
                return (
                  <Label className="gap-2 font-normal" htmlFor={checkboxId} key={component.id}>
                    <Checkbox
                      checked={checked}
                      id={checkboxId}
                      onCheckedChange={(next) =>
                        onChange({
                          componentIds: next
                            ? [...value.componentIds, component.id]
                            : value.componentIds.filter((id) => id !== component.id)
                        })
                      }
                    />
                    {component.name}
                  </Label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">{m.products__requirements()}</p>
          <p className="text-xs text-muted-foreground">{m.products__requirements_hint()}</p>
          <RequirementEditor
            earlierGroups={earlierGroups}
            onChange={(requirements) => onChange({ requirements })}
            requirements={value.requirements}
          />
        </div>

        <Button
          className="self-start text-destructive hover:text-destructive"
          onClick={onRemove}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X data-icon="inline-start" />
          {m.products__remove_value()}
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}

export function ProductConfigurationEditor({
  groups: savedGroups,
  isSaving,
  onSave,
  organizationSlug
}: {
  groups: ProductEditor["groups"];
  isSaving: boolean;
  onSave: (groups: ProductEditorConfiguration) => void;
  organizationSlug: string;
}) {
  const [groups, setGroups] = useState<EditableGroup[]>(() => toEditableGroups(savedGroups));
  const [dirty, setDirty] = useState(false);
  const componentsQuery = useQuery(getInventoryListQueryOptions(organizationSlug));
  const components = (componentsQuery.data ?? []).map((component) => {
    return {
      id: component.id,
      name: component.name
    };
  });

  const mutate = (next: EditableGroup[]) => {
    setGroups(next);
    setDirty(true);
  };
  const updateGroup = (index: number, update: (group: EditableGroup) => EditableGroup) => {
    mutate(groups.map((group, i) => (i === index ? update(group) : group)));
  };
  const patchValue = (groupIndex: number, valueUid: string, patch: Partial<EditableValue>) => {
    mutate(
      groups.map((group, i) => {
        if (i !== groupIndex || group.type === "number") return group;
        return {
          ...group,
          values: group.values.map((value) =>
            value.uid === valueUid ? { ...value, ...patch } : value
          )
        };
      })
    );
  };
  const moveGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  };
  const addGroup = (type: GroupType) => {
    const ordinal = groups.length + 1;
    const common = {
      key: `group-${ordinal}`,
      label: "",
      persisted: false,
      required: false,
      uid: nextUid()
    };
    mutate([
      ...groups,
      type === "number"
        ? { ...common, included: 0, maximum: 0, minimum: 0, step: 1, type: "number" }
        : { ...common, type, values: [] }
    ]);
  };

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ListPlus />
          <h2>{m.products__configuration_title()}</h2>
        </CardTitle>
        <CardDescription>{m.products__configuration_description()}</CardDescription>
        {dirty ? (
          <CardAction>
            <Badge variant="outline">{m.products__unsaved()}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {m.products__configuration_empty()}
          </p>
        ) : (
          <Accordion defaultValue={groups[0] ? [groups[0].uid] : []} hiddenUntilFound multiple>
            {groups.map((group, index) => {
              const earlierGroups = groups
                .slice(0, index)
                .filter(
                  (candidate): candidate is EditableDiscreteGroup => candidate.type !== "number"
                );
              return (
                <AccordionItem key={group.uid} value={group.uid}>
                  <AccordionTrigger className="items-center">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground font-mono text-xs font-semibold text-background">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate">
                          {labelOrFallback(group.label, group.key)}
                        </strong>
                        <span className="block truncate font-mono text-[11px] font-normal text-muted-foreground">
                          {group.key}
                        </span>
                      </span>
                      <Badge className="hidden sm:inline-flex" variant="secondary">
                        {groupTypeLabel[group.type]()}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label={m.products__move_up()}
                          disabled={index === 0}
                          onClick={() => moveGroup(index, -1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          aria-label={m.products__move_down()}
                          disabled={index === groups.length - 1}
                          onClick={() => moveGroup(index, 1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <ArrowDown />
                        </Button>
                      </div>
                      <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => mutate(groups.filter((_, i) => i !== index))}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 data-icon="inline-start" />
                        {m.products__remove_group()}
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`${group.uid}-label`}>
                          {m.products__group_label()}
                        </FieldLabel>
                        <Input
                          id={`${group.uid}-label`}
                          onChange={(event) =>
                            updateGroup(index, (current) => {
                              return {
                                ...current,
                                label: event.target.value
                              };
                            })
                          }
                          value={group.label}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${group.uid}-key`}>
                          {m.products__group_key()}
                        </FieldLabel>
                        <Input
                          disabled={group.persisted}
                          id={`${group.uid}-key`}
                          onChange={(event) =>
                            updateGroup(index, (current) => {
                              return {
                                ...current,
                                key: event.target.value
                              };
                            })
                          }
                          value={group.key}
                        />
                        <FieldDescription>
                          {group.persisted
                            ? m.products__identifier_locked()
                            : m.products__group_key_hint()}
                        </FieldDescription>
                      </Field>
                    </div>

                    <Label className="w-fit gap-2 font-normal" htmlFor={`${group.uid}-required`}>
                      <Checkbox
                        checked={group.required}
                        id={`${group.uid}-required`}
                        onCheckedChange={(next) =>
                          updateGroup(index, (current) => {
                            return { ...current, required: next === true };
                          })
                        }
                      />
                      {m.products__required()}
                    </Label>

                    {group.type === "number" ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <NumberField
                          id={`${group.uid}-min`}
                          label={m.products__group_number_min()}
                          onChange={(value) =>
                            updateGroup(index, (current) =>
                              current.type === "number" ? { ...current, minimum: value } : current
                            )
                          }
                          value={group.minimum}
                        />
                        <NumberField
                          id={`${group.uid}-max`}
                          label={m.products__group_number_max()}
                          onChange={(value) =>
                            updateGroup(index, (current) =>
                              current.type === "number" ? { ...current, maximum: value } : current
                            )
                          }
                          value={group.maximum}
                        />
                        <NumberField
                          id={`${group.uid}-step`}
                          label={m.products__group_number_step()}
                          onChange={(value) =>
                            updateGroup(index, (current) =>
                              current.type === "number" ? { ...current, step: value } : current
                            )
                          }
                          value={group.step}
                        />
                        <NumberField
                          id={`${group.uid}-included`}
                          label={m.products__group_number_included()}
                          onChange={(value) =>
                            updateGroup(index, (current) =>
                              current.type === "number" ? { ...current, included: value } : current
                            )
                          }
                          value={group.included}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium">{m.products__values()}</h3>
                            <p className="text-xs text-muted-foreground">
                              {group.values.length} {m.products__values().toLocaleLowerCase()}
                            </p>
                          </div>
                          <Button
                            onClick={() =>
                              updateGroup(index, (current) =>
                                current.type === "number"
                                  ? current
                                  : {
                                      ...current,
                                      values: [
                                        ...current.values,
                                        {
                                          componentIds: [],
                                          id: crypto.randomUUID(),
                                          imageUrl: null,
                                          label: "",
                                          persisted: false,
                                          requirements: [],
                                          uid: nextUid()
                                        }
                                      ]
                                    }
                              )
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Plus data-icon="inline-start" />
                            {m.products__add_value()}
                          </Button>
                        </div>
                        {group.values.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{m.products__no_values()}</p>
                        ) : (
                          <Accordion
                            defaultValue={group.values
                              .filter((value) => !value.persisted)
                              .map((value) => value.uid)}
                            hiddenUntilFound
                            multiple
                          >
                            {group.values.map((value) => (
                              <ValueEditor
                                components={components}
                                earlierGroups={earlierGroups}
                                key={value.uid}
                                onChange={(patch) => patchValue(index, value.uid, patch)}
                                onRemove={() =>
                                  updateGroup(index, (current) =>
                                    current.type === "number"
                                      ? current
                                      : {
                                          ...current,
                                          values: current.values.filter(
                                            (item) => item.uid !== value.uid
                                          )
                                        }
                                  )
                                }
                                value={value}
                              />
                            ))}
                          </Accordion>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Select
              onValueChange={(value) => {
                if (value === "single" || value === "boolean" || value === "number") {
                  addGroup(value);
                }
              }}
              value=""
            >
              <SelectTrigger aria-label={m.products__add_group()} className="w-40">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Plus />
                  {m.products__add_group()}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="single">{m.products__group_single()}</SelectItem>
                  <SelectItem value="boolean">{m.products__group_boolean()}</SelectItem>
                  <SelectItem value="number">{m.products__group_number()}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={isSaving || !dirty}
            onClick={() => onSave(toConfiguration(groups))}
            type="button"
          >
            {isSaving ? m.products__saving() : m.products__save_configuration()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
