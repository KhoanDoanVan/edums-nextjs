import Image from "next/image";
import Link from "next/link";

interface AuthPageShellProps {
  mode: "login" | "register";
  children: React.ReactNode;
}

const tabClass = (active: boolean): string =>
  active
    ? "rounded-[4px] bg-[#186da1] px-3 py-1.5 text-xs font-semibold text-white"
    : "rounded-[4px] border border-[#c7d1dc] bg-white px-3 py-1.5 text-xs font-semibold text-[#2f4f68] transition hover:bg-[#f4f8fb]";

export const AuthPageShell = ({ mode, children }: AuthPageShellProps) => {
  return (
    <div className="min-h-screen bg-[#ececef] md:flex md:h-screen md:flex-col">
      <div className="flex-1 md:grid md:grid-cols-[minmax(0,3.2fr)_minmax(360px,1fr)]">
        <section className="relative hidden md:block">
          <Image
            src="/images/sgu-campus-2.jpg"
            alt="Saigon University campus"
            fill
            priority
            className="object-cover object-[55%_62%]"
            sizes="75vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-black/20" />
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-7 md:px-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-4 flex justify-center">
              <div className="flex h-[126px] w-[126px] items-center justify-center rounded-full border-[3px] border-[#89b7d8] bg-[#66d0ee] shadow-[0_2px_6px_rgba(17,76,116,0.25)]">
                <div className="text-center leading-tight">
                  <p className="text-[11px] font-semibold tracking-[0.09em] text-[#0b4f85]">
                    ĐẠI HỌC SÀI GÒN
                  </p>
                  <p className="text-[42px] font-extrabold tracking-[0.02em] text-[#1b3b98]">
                    SGU
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[5px] border border-[#cdd2d8] bg-[#efefef] p-4 shadow-[0_1px_0_rgba(255,255,255,0.95)]">
              <div className="mb-3 flex gap-2">
                <Link href="/login" className={tabClass(mode === "login")}>
                  Đăng nhập
                </Link>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>

      <footer className="hidden h-14 items-center justify-center bg-[#006da7] text-[34px] font-black tracking-[0.03em] text-white md:flex">
        <span className="text-xl">TRƯỜNG ĐẠI HỌC SÀI GÒN</span>
      </footer>
    </div>
  );
};
