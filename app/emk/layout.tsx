import { Header, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { EmkSidebar, EmkMobileTabs } from "@/components/layout/EmkSidebar";

export default function EmkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <MobileHeader />
      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 py-6 md:px-6">
        <EmkSidebar />
        <main className="min-w-0 flex-1">
          <EmkMobileTabs />
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
