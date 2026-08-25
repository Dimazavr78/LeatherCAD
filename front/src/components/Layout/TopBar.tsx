export function TopBar() {
    return (
        <header className="top-bar">
            <div className="brand">
                <div className="brand-mark">L</div>

                <span className="brand-name">LeatherCAD</span>
            </div>

            <nav className="menu">
                <button>File</button>
                <button>Edit</button>
                <button>View</button>
                <button>Project</button>
                <button>Help</button>
            </nav>

            <div className="local-status">
                <span className="status-dot" />
                Local
            </div>
        </header>
    );
}