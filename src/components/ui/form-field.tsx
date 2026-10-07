"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
  type UseFormStateReturn,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "./form";

/**
 * FormField composition (control + label + error text) for react-hook-form —
 * the thin shadcn-style wrapper layer over the primitives in form.tsx.
 * Per the form.tsx comment, the wizard/dashboard phases own this composition.
 *
 * Usage:
 *   <Form {...form}>
 *     <form onSubmit={...}>
 *       <FormField control={form.control} name="email" render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>Email</FormLabel>
 *           <FormControl><Input {...field} /></FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )} />
 *     </form>
 *   </Form>
 */

function Form<TFieldValues extends FieldValues, TContext = unknown, TTransformedValues = TFieldValues>(
  props: UseFormReturn<TFieldValues, TContext, TTransformedValues> & {
    children: React.ReactNode;
  }
) {
  const { children, ...methods } = props;
  return <FormProvider {...methods}>{children}</FormProvider>;
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName };

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

function FormField<TFieldValues extends FieldValues>({
  control,
  name,
  render,
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  render: (props: {
    field: ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<TFieldValues>;
  }) => React.ReactElement;
}) {
  return (
    <FormFieldContext.Provider value={{ name }}>
      <Controller control={control} name={name} render={render} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const { getFieldState, formState } = useFormContext();
  if (!fieldContext?.name) {
    throw new Error("useFormField must be used inside a FormField");
  }
  const fieldState = getFieldState(fieldContext.name, formState);
  return { ...fieldState, name: fieldContext.name };
}

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
));
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => (
  <Label ref={ref} className={className} {...props} />
));
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} data-slot="form-control" {...props} />
));
FormControl.displayName = "FormControl";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error } = useFormField();
  const body = error ? String(error.message) : children;
  if (!body) return null;
  return (
    <p
      ref={ref}
      role="alert"
      data-slot="form-message"
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage };
