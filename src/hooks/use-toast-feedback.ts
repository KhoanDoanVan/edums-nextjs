"use client";

import { useEffect } from "react";
import { useToast } from "@/context/toast-context";

interface UseToastFeedbackOptions {
  successMessage?: string;
  errorMessage?: string;
  successTitle?: string;
  errorTitle?: string;
}

export const shouldHideFeedbackMessage = (message: string): boolean => {
  const normalizedMessage = message.trim();

  return [
    /^Đã tải\b/i,
    /^Đang lọc\b/i,
    /^Đã xóa bộ lọc\b/i,
    /^Đã chuyển về\b/i,
    /^Sử dụng module\b/i,
    /^Đã tìm thấy\b/i,
  ].some((pattern) => pattern.test(normalizedMessage));
};

export const useToastFeedback = ({
  successMessage,
  errorMessage,
  successTitle = "Thành công",
  errorTitle = "Có lỗi xảy ra",
}: UseToastFeedbackOptions) => {
  const toast = useToast();

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    if (shouldHideFeedbackMessage(successMessage)) {
      return;
    }

    toast.success(successMessage, successTitle);
  }, [successMessage, successTitle, toast]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }
    toast.error(errorMessage, errorTitle);
  }, [errorMessage, errorTitle, toast]);
};
