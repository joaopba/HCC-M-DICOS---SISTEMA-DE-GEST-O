import React from "react";

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught: ", error, info);
  }

  handleRetry = () => {
    // Force full reload to recover from errors
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen p-6">
          <div className="max-w-2xl mx-auto p-6 rounded-lg border bg-destructive/5 border-destructive/20">
            <h1 className="text-xl font-semibold text-destructive">Erro ao carregar {this.props.pageName || 'página'}</h1>
            <p className="text-sm text-muted-foreground mt-2">Ocorreu um problema inesperado. Tente novamente.</p>
            {this.state.error?.message && (
              <p className="mt-2 text-xs text-muted-foreground break-all">Detalhes: {String(this.state.error.message)}</p>
            )}
            <button onClick={this.handleRetry} className="mt-4 inline-flex items-center px-4 py-2 rounded-md border">
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}