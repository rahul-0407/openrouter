import { treaty } from '@elysiajs/eden'
import type { App } from 'app'
import { createContext, useContext } from 'react';

const client = treaty<App>('localhost:3000', {
    fetch: {
        credentials: 'include'
    }
}) ;

const ElysiaClientContext = createContext(client);

export const ElysiaClientContextProvider = ElysiaClientContext.Provider;
export const useElysiaClient = () => {
    const client = useContext(ElysiaClientContext);
    return client;
}