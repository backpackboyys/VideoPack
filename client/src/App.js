function requiresAgeGate() {
  return (
    sessionStorage.getItem(
      "age_gate_passed"
    ) !== "true"
  );
}

function AgeProtectedRoute({
  children,
  nextPath
}) {
  if (requiresAgeGate()) {
    return (
      <Navigate
        to={`/age-gate?next=${encodeURIComponent(
          nextPath
        )}`}
        replace
      />
    );
  }

  return children;
}
