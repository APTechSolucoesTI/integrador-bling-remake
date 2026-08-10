import type { Metadata } from "next";
import { PublicDemoApp } from "../../components/demo/public-demo-app";

export const metadata: Metadata = {
  title: "Demonstração pública",
  description:
    "Explore o APBling sem cadastro usando dados fictícios armazenados no seu navegador.",
};

export default function DemoPage() {
  return <PublicDemoApp />;
}
