import AuthForm from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmation?: string }> }) {
  const { confirmation } = await searchParams;
  return <main className="shell auth-page">
    {confirmation === "error" && <p className="notice error" role="alert">Patvirtinimo nuoroda netinkama, pasibaigusi arba jau panaudota. Jei el. paštą jau patvirtinote, prisijunkite. Kitu atveju patikrinkite naujausią laišką ir atidarykite nuorodą toje pačioje naršyklėje, kurioje registravotės.</p>}
    <AuthForm mode="login" />
  </main>;
}
