"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export default function CustomerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSearchParam = searchParams.get("search") || "";

    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    } else {
      params.delete("search");
    }
    // Only reset pagination when the search term itself actually changed
    // (not on mount, and not when unrelated params like `page` change)
    if (searchTerm.trim() !== currentSearchParam) {
      params.delete("page");
    }

    // Prevent unnecessary navigation if search hasn't changed
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();

    if (newSearch !== currentSearch) {
      router.push(`?${newSearch}`, { scroll: false });
    }
  }, [searchTerm, router, searchParams]);

  return (
    <div className="relative w-full sm:w-80">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหาชื่อหรือรหัสลูกค้า..."
        className="input h-10 pl-10 pr-9 w-full"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
