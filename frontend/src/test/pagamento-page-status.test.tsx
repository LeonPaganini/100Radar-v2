/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api", () => ({
  getConsultaDetails: vi.fn(async () => ({
    query_id: "uuid",
    paid: false,
    status: "PAYMENT_REQUIRED",
    status_na_data: "VALIDO",
    numero_inmetro: "14826019",
    data_infracao: "2026-04-28",
  })),
  createOrGetPixPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
}));

import Pagamento from "@/pages/Pagamento";

describe("Pagamento status", () => {
  it("exibe status valido sem fallback indeterminado", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/pagamento/uuid"]}>
          <Routes><Route path="/pagamento/:queryId" element={<Pagamento />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Situação preliminar:/)) .toBeTruthy();
    expect(screen.getByText(/VALIDO/)) .toBeTruthy();
    expect(screen.queryByText(/^INDETERMINADO$/)).not .toBeTruthy();
  });
});
