import { Toaster as Sonner } from "sonner";

/** One toaster for the whole app; mutations call toast.success / toast.error. Bottom-centre, above the bottom nav. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-cc-lg !border !border-cc-line-strong !bg-[#1d0b36] !text-cc-ink !shadow-[0_20px_50px_rgba(6,3,11,.6)] !text-[13px] !font-semibold",
          description: "!text-cc-lavender",
          success: "[&_svg]:!text-cc-ok",
          error: "[&_svg]:!text-cc-danger",
        },
      }}
    />
  );
}
