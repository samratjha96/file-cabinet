# File Cabinet Frontend

Clean, modern React application for file upload and management.

## Architecture

- **React 19**: Latest React with TypeScript
- **Vite 7**: Fast development and build tool
- **Custom Hooks**: Business logic extracted into reusable hooks
- **Simple Components**: Small, focused components under 200 lines
- **Shared Utils**: Common utilities for file handling

## Key Features

- **Clean State Management**: `useUpload` and `useFiles` hooks manage all application state
- **File Validation**: Automatic validation of file types and sizes
- **Progress Tracking**: Real-time upload progress with overall statistics
- **Error Handling**: User-friendly error messages and retry functionality
- **Responsive Design**: Works on desktop and mobile devices

## Development

The application is designed to be simple and maintainable:

1. **Components**: UI-only components that receive props
2. **Hooks**: Business logic and state management
3. **Utils**: Shared functions for file operations
4. **API**: Simple service layer for backend communication

## Code Quality

- All components are under 200 lines
- Custom hooks handle complex state logic
- Shared utilities prevent code duplication
- Clean separation of concerns throughout

## Getting Started

```bash
# Run locally
make dev

# Run in docker
make prod
```

## Project Structure

```
src/
├── components/          # UI components
│   ├── FileUpload.tsx
│   ├── FileList.tsx
│   └── UploadProgress.tsx
├── hooks/              # Custom hooks
│   ├── useUpload.ts
│   └── useFiles.ts
├── utils.ts            # Shared utilities
├── api.ts              # API service
├── config.ts           # Configuration
└── App.tsx             # Main component
```
