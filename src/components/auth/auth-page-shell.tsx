import Image from "next/image";

interface AuthPageShellProps {
  children: React.ReactNode;
}

export const AuthPageShell = ({ children }: AuthPageShellProps) => {
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
              <Image
                src="/images/SGU-LOGO.png"
                alt="Logo Đại học Sài Gòn"
                width={220}
                height={220}
                priority
                className="h-[170px] w-[170px] object-contain drop-shadow-[0_2px_6px_rgba(17,76,116,0.25)] sm:h-[200px] sm:w-[200px]"
              />
            </div>

            <div className="rounded-[5px] border border-[#cdd2d8] bg-[#efefef] p-4 shadow-[0_1px_0_rgba(255,255,255,0.95)]">
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
