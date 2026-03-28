"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/context/toast-context";

interface UseToastFeedbackOptions {
  successMessage?: string;
  errorMessage?: string;
  successTitle?: string;
  errorTitle?: string;
}

export const useToastFeedback = ({
  successMessage,
  errorMessage,
  successTitle = "Thành công",
  errorTitle = "Có lỗi xảy ra",
}: UseToastFeedbackOptions) => {
  const toast = useToast();
  const lastSuccessRef = useRef("");
  const lastErrorRef = useRef("");

  useEffect(() => {
    if (!successMessage || successMessage === lastSuccessRef.current) {
      return;
    }

    lastSuccessRef.current = successMessage;
    toast.success(successMessage, successTitle);
  }, [successMessage, successTitle, toast]);

  useEffect(() => {
    if (!errorMessage || errorMessage === lastErrorRef.current) {
      return;
    }

    lastErrorRef.current = errorMessage;
    toast.error(errorMessage, errorTitle);
  }, [errorMessage, errorTitle, toast]);
};
